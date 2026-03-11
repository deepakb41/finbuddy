from __future__ import annotations

import io
import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from datetime import date

from src.insights.summaries import (
    monthly_spend_by_category,
    monthly_trend,
    top_merchants,
    category_comparison,
    total_spend,
    recent_transactions,
)
from src.data.pipeline import ingest_from_form, standardize_df, enrich_df, upsert_transactions
from src.data.loaders.csv_loader import load_csv
from src.agents.categorizer import categorize_transaction
from src.data.queries import update_transaction_category

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="FinBuddy",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="collapsed",
)

CATEGORIES = [
    "Groceries", "Eating Out", "Transport", "Shopping", "Subscriptions",
    "Rent", "Bills", "Personal Care", "Fitness", "Travel",
    "Investment", "Income", "Transfer", "Misc", "Uncategorized",
]

CURRENCIES = ["GBP", "USD", "EUR", "INR", "AUD", "CAD", "SGD"]

# ── Sidebar ─────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("💰 FinBuddy")
    st.caption("AI-Powered Finance Tracker")
    st.divider()

    auto_refresh = st.toggle("Auto-refresh (60s)", value=False)
    if auto_refresh:
        import time
        st.caption(f"Last refreshed: {pd.Timestamp.now().strftime('%H:%M:%S')}")
        time.sleep(60)
        st.rerun()

    st.divider()
    if st.button("🔄 Refresh data now", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

# ── Cached data loaders ─────────────────────────────────────────────────────────
@st.cache_data(ttl=60)
def get_totals():
    return total_spend()

@st.cache_data(ttl=60)
def get_category_spend():
    rows = monthly_spend_by_category()
    if not rows:
        return pd.DataFrame(columns=["month", "category", "total_amount"])
    df = pd.DataFrame(rows, columns=["month", "category", "total_amount"])
    df["month"] = pd.to_datetime(df["month"])
    df["total_amount"] = df["total_amount"].astype(float)
    return df

@st.cache_data(ttl=60)
def get_trend():
    rows = monthly_trend(6)
    if not rows:
        return pd.DataFrame(columns=["month", "category", "total_amount"])
    df = pd.DataFrame(rows, columns=["month", "category", "total_amount"])
    df["month"] = pd.to_datetime(df["month"])
    df["total_amount"] = df["total_amount"].astype(float)
    return df

@st.cache_data(ttl=60)
def get_top_merchants():
    rows = top_merchants()
    if not rows:
        return pd.DataFrame(columns=["merchant", "total_amount", "tx_count"])
    return pd.DataFrame(rows, columns=["merchant", "total_amount", "tx_count"])

@st.cache_data(ttl=60)
def get_comparison():
    rows = category_comparison()
    if not rows:
        return pd.DataFrame(columns=["category", "this_month", "last_month"])
    df = pd.DataFrame(rows, columns=["category", "this_month", "last_month"])
    df["this_month"] = df["this_month"].astype(float)
    df["last_month"] = df["last_month"].astype(float)
    df["change_pct"] = df.apply(
        lambda r: (r["this_month"] - r["last_month"]) / r["last_month"] * 100
        if r["last_month"] > 0 else None,
        axis=1,
    )
    return df

@st.cache_data(ttl=60)
def get_transactions():
    rows = recent_transactions(200)
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=[
        "transaction_id", "date", "merchant_raw", "merchant_normalized",
        "amount", "currency", "type", "category", "notes", "status",
    ])
    df["amount"] = df["amount"].astype(float)
    df["date"] = pd.to_datetime(df["date"])
    return df

# ── Tabs ─────────────────────────────────────────────────────────────────────────
tab_dashboard, tab_transactions, tab_add, tab_import, tab_insights = st.tabs([
    "📊 Dashboard",
    "📋 Transactions",
    "➕ Add Transaction",
    "📂 Import CSV",
    "🤖 AI Insights",
])

# ╔══════════════════════════════════════════════════════════╗
# ║  TAB 1 — DASHBOARD                                       ║
# ╚══════════════════════════════════════════════════════════╝
with tab_dashboard:
    st.header("Dashboard")

    totals = get_totals()
    cat_df = get_category_spend()
    trend_df = get_trend()
    top_m_df = get_top_merchants()
    comp_df = get_comparison()

    # ── Summary cards ──────────────────────────────────────────
    c1, c2, c3, c4 = st.columns(4)

    total_exp = float(totals.total_expense or 0) if totals else 0
    total_inc = float(totals.total_income or 0) if totals else 0
    tx_count = int(totals.tx_count or 0) if totals else 0

    biggest_cat = "—"
    biggest_cat_amt = 0.0
    if not cat_df.empty:
        this_month_str = pd.Timestamp.now().to_period("M").to_timestamp()
        this_month_df = cat_df[cat_df["month"] == this_month_str]
        if not this_month_df.empty:
            top_row = this_month_df.loc[this_month_df["total_amount"].idxmax()]
            biggest_cat = top_row["category"]
            biggest_cat_amt = top_row["total_amount"]

    # MoM total change
    mom_delta = None
    if not comp_df.empty:
        last_m_total = comp_df["last_month"].sum()
        this_m_total = comp_df["this_month"].sum()
        if last_m_total > 0:
            mom_delta = (this_m_total - last_m_total) / last_m_total * 100

    c1.metric("💸 Total Spent (This Month)", f"£{total_exp:,.2f}",
              delta=f"{mom_delta:+.1f}% vs last month" if mom_delta is not None else None,
              delta_color="inverse")
    c2.metric("💰 Total Income (This Month)", f"£{total_inc:,.2f}")
    c3.metric("🔢 Transactions", tx_count)
    c4.metric("📌 Biggest Category", biggest_cat, f"£{biggest_cat_amt:,.2f}")

    st.divider()

    # ── Charts row ─────────────────────────────────────────────
    col_pie, col_bar = st.columns([1, 2])

    with col_pie:
        st.subheader("Spend by Category (This Month)")
        if not comp_df.empty and comp_df["this_month"].sum() > 0:
            this_m_cats = comp_df[comp_df["this_month"] > 0]
            fig_pie = px.pie(
                this_m_cats,
                values="this_month",
                names="category",
                hole=0.4,
                color_discrete_sequence=px.colors.qualitative.Set3,
            )
            fig_pie.update_traces(textposition="inside", textinfo="percent+label")
            fig_pie.update_layout(showlegend=False, margin=dict(t=10, b=10, l=10, r=10))
            st.plotly_chart(fig_pie, use_container_width=True)
        else:
            st.info("No expense data for this month yet.")

    with col_bar:
        st.subheader("Monthly Spending Trend (Last 6 Months)")
        if not trend_df.empty:
            fig_bar = px.bar(
                trend_df,
                x="month",
                y="total_amount",
                color="category",
                barmode="stack",
                labels={"total_amount": "Amount (£)", "month": "Month"},
                color_discrete_sequence=px.colors.qualitative.Set3,
            )
            fig_bar.update_layout(
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                margin=dict(t=40, b=10),
                xaxis=dict(tickformat="%b %Y"),
            )
            st.plotly_chart(fig_bar, use_container_width=True)
        else:
            st.info("No trend data available yet.")

    st.divider()

    # ── MoM comparison table + Top merchants ──────────────────
    col_comp, col_top = st.columns(2)

    with col_comp:
        st.subheader("Month-over-Month Comparison")
        if not comp_df.empty:
            display_comp = comp_df.copy()
            display_comp["this_month"] = display_comp["this_month"].map("£{:,.2f}".format)
            display_comp["last_month"] = display_comp["last_month"].map("£{:,.2f}".format)
            display_comp["change_pct"] = comp_df["change_pct"].map(
                lambda x: f"{x:+.1f}%" if pd.notna(x) else "new"
            )
            display_comp.columns = ["Category", "This Month", "Last Month", "Change"]
            st.dataframe(display_comp, use_container_width=True, hide_index=True)
        else:
            st.info("No comparison data available.")

    with col_top:
        st.subheader("Top Merchants (This Month)")
        if not top_m_df.empty:
            display_top = top_m_df.copy()
            display_top["total_amount"] = display_top["total_amount"].astype(float).map("£{:,.2f}".format)
            display_top.columns = ["Merchant", "Total Spent", "# Transactions"]
            st.dataframe(display_top, use_container_width=True, hide_index=True)
        else:
            st.info("No merchant data for this month.")

# ╔══════════════════════════════════════════════════════════╗
# ║  TAB 2 — TRANSACTIONS                                    ║
# ╚══════════════════════════════════════════════════════════╝
with tab_transactions:
    st.header("Transactions")

    tx_df = get_transactions()

    if tx_df.empty:
        st.info("No transactions in the database yet. Add some or import a CSV.")
    else:
        # Filters
        fcol1, fcol2, fcol3 = st.columns(3)
        with fcol1:
            filter_cat = st.multiselect(
                "Filter by category", options=sorted(tx_df["category"].dropna().unique())
            )
        with fcol2:
            filter_type = st.multiselect(
                "Filter by type", options=["expense", "income", "transfer"]
            )
        with fcol3:
            search = st.text_input("Search merchant", "")

        filtered = tx_df.copy()
        if filter_cat:
            filtered = filtered[filtered["category"].isin(filter_cat)]
        if filter_type:
            filtered = filtered[filtered["type"].isin(filter_type)]
        if search:
            filtered = filtered[
                filtered["merchant_raw"].str.contains(search, case=False, na=False)
            ]

        st.caption(f"Showing {len(filtered)} of {len(tx_df)} transactions")

        # Display table with inline category correction
        display_df = filtered[[
            "date", "merchant_raw", "amount", "currency", "type", "category", "notes", "status", "transaction_id"
        ]].copy()
        display_df["date"] = display_df["date"].dt.strftime("%Y-%m-%d")
        display_df["amount"] = display_df["amount"].map("£{:,.2f}".format)

        st.dataframe(display_df.drop(columns=["transaction_id"]), use_container_width=True, hide_index=True)

        # Inline category correction
        st.divider()
        st.subheader("Correct a Category")
        correct_col1, correct_col2, correct_col3 = st.columns([2, 1, 1])
        with correct_col1:
            tx_options = {
                f"{row['date'].strftime('%Y-%m-%d')} | {row['merchant_raw']} | £{row['amount']:.2f}": row["transaction_id"]
                for _, row in filtered.iterrows()
            }
            selected_label = st.selectbox("Select transaction", options=list(tx_options.keys()))
        with correct_col2:
            new_cat = st.selectbox("New category", options=CATEGORIES, key="correction_cat")
        with correct_col3:
            st.write("")
            st.write("")
            if st.button("✅ Apply correction"):
                tx_id = tx_options[selected_label]
                update_transaction_category(tx_id, new_cat, status="corrected")
                st.success(f"Updated to: {new_cat}")
                st.cache_data.clear()
                st.rerun()

# ╔══════════════════════════════════════════════════════════╗
# ║  TAB 3 — ADD TRANSACTION                                 ║
# ╚══════════════════════════════════════════════════════════╝
with tab_add:
    st.header("Add Transaction")

    with st.form("add_transaction_form", clear_on_submit=True):
        fcol1, fcol2 = st.columns(2)
        with fcol1:
            tx_date = st.date_input("Date", value=date.today())
            merchant = st.text_input("Merchant / Description", placeholder="e.g. Uber, Zomato, Amazon")
            amount = st.number_input("Amount", min_value=0.01, value=10.0, step=0.01)

        with fcol2:
            currency = st.selectbox("Currency", options=CURRENCIES)
            tx_type = st.selectbox("Type", options=["expense", "income", "transfer"])
            category = st.selectbox(
                "Category (leave as Uncategorized to auto-assign)",
                options=CATEGORIES,
                index=CATEGORIES.index("Uncategorized"),
            )

        notes = st.text_input("Notes (optional)", placeholder="e.g. Airport ride")

        submitted = st.form_submit_button("➕ Add Transaction", use_container_width=True)

    if submitted:
        if not merchant.strip():
            st.error("Please enter a merchant name.")
        else:
            with st.spinner("Saving..."):
                tx_id = ingest_from_form(
                    date=tx_date.strftime("%Y-%m-%d"),
                    merchant_raw=merchant.strip(),
                    amount=amount,
                    currency=currency,
                    tx_type=tx_type,
                    notes=notes.strip(),
                    category=category,
                )
            st.success(f"✅ Transaction saved! ID: `{tx_id}`")
            st.cache_data.clear()

    st.divider()
    st.subheader("Quick AI Categorization Test")
    st.caption("Not saved — just test how the AI would categorize a transaction.")

    with st.form("categorize_test"):
        test_merchant = st.text_input("Merchant", "Uber Eats")
        test_amount = st.number_input("Amount", value=24.0)
        test_type = st.selectbox("Type", ["expense", "income", "transfer"], key="test_type")
        test_notes = st.text_input("Notes", "")
        if st.form_submit_button("🤖 Auto-categorize"):
            with st.spinner("Calling AI..."):
                result = categorize_transaction(
                    date=date.today().strftime("%Y-%m-%d"),
                    merchant_raw=test_merchant,
                    amount=test_amount,
                    currency="GBP",
                    tx_type=test_type,
                    notes=test_notes,
                    merchant_hint=None,
                )
            st.json(result.model_dump())

# ╔══════════════════════════════════════════════════════════╗
# ║  TAB 4 — IMPORT CSV                                      ║
# ╚══════════════════════════════════════════════════════════╝
with tab_import:
    st.header("Import CSV")
    st.caption(
        "Upload a CSV export from your bank. Columns are auto-detected. "
        "Common formats (Monzo, Revolut, HDFC, SBI, etc.) are supported."
    )

    uploaded = st.file_uploader("Choose a CSV file", type=["csv"])

    if uploaded is not None:
        with st.spinner("Parsing CSV..."):
            try:
                raw_df = load_csv(io.BytesIO(uploaded.read()))
                st.success(f"Parsed {len(raw_df)} rows.")
                st.subheader("Preview (first 20 rows)")
                st.dataframe(raw_df.head(20), use_container_width=True)

                if st.button("📥 Import all rows into database"):
                    with st.spinner("Processing..."):
                        std_df = standardize_df(raw_df)
                        enriched_df = enrich_df(
                            std_df,
                            aliases_path="config/merchants_aliases.yml",
                            category_rules_path="config/category_rules.yml",
                        )
                        count = upsert_transactions(enriched_df)
                    st.success(f"✅ Imported {count} transactions.")
                    st.cache_data.clear()

            except Exception as e:
                st.error(f"Failed to parse CSV: {e}")

    st.divider()
    st.subheader("Expected CSV Columns")
    st.markdown("""
The importer auto-detects these column names (case-insensitive):

| Our Field | Accepted Column Names |
|---|---|
| Date | `date`, `transaction date`, `value date`, `posted date` |
| Merchant | `description`, `merchant`, `payee`, `narration`, `memo` |
| Amount | `amount`, `transaction amount` — or separate `debit`/`credit` columns |
| Currency | `currency`, `ccy` |
| Type | `type`, `transaction type` |
| Notes | `notes`, `reference`, `remarks` |
    """)

# ╔══════════════════════════════════════════════════════════╗
# ║  TAB 5 — AI INSIGHTS                                     ║
# ╚══════════════════════════════════════════════════════════╝
with tab_insights:
    st.header("AI Insights")
    st.caption(
        "The AI analyzes your last 3 months of spending and generates personalized observations and recommendations."
    )

    if "insights_text" not in st.session_state:
        st.session_state["insights_text"] = None

    if st.button("🤖 Generate Insights", use_container_width=True):
        with st.spinner("Analyzing your spending data..."):
            try:
                from src.agents.insight_agent import generate_insights
                insights = generate_insights()
                st.session_state["insights_text"] = insights
            except Exception as e:
                st.error(f"Could not generate insights: {e}")

    if st.session_state.get("insights_text"):
        st.divider()
        st.markdown(st.session_state["insights_text"])

    st.divider()
    st.subheader("Spending Summary for Context")
    comp_df2 = get_comparison()
    if not comp_df2.empty:
        fig_comp = go.Figure()
        fig_comp.add_trace(go.Bar(
            name="Last Month",
            x=comp_df2["category"],
            y=comp_df2["last_month"],
            marker_color="lightblue",
        ))
        fig_comp.add_trace(go.Bar(
            name="This Month",
            x=comp_df2["category"],
            y=comp_df2["this_month"],
            marker_color="steelblue",
        ))
        fig_comp.update_layout(
            barmode="group",
            title="Category Spend: This Month vs Last Month",
            yaxis_title="Amount (£)",
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
            margin=dict(t=60, b=10),
        )
        st.plotly_chart(fig_comp, use_container_width=True)
    else:
        st.info("No comparison data available yet.")
