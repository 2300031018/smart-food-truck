import sys
import os
import json
import base64
import io
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pymongo import MongoClient
from datetime import datetime, timedelta
from dotenv import load_dotenv
from bson import ObjectId

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/smart-food-truck')

def get_db():
    client = MongoClient(MONGO_URI)
    return client.get_database()

def fig_to_base64(fig):
    img = io.BytesIO()
    fig.savefig(img, format='png', bbox_inches='tight', dpi=100)
    img.seek(0)
    return base64.b64encode(img.getvalue()).decode('utf-8')

def run_analytics(truck_id=None, days=30):
    db = get_db()
    start_date = datetime.now() - timedelta(days=days)
    
    query = {
        'status': 'COMPLETED',
        'placedAt': {'$gte': start_date}
    }
    if truck_id:
        query['truck'] = ObjectId(truck_id)
        
    orders = list(db.orders.find(query))
    
    if not orders:
        return {
            "summary": {"totalRevenue": 0, "orderCount": 0, "avgOrderValue": 0},
            "charts": {}
        }

    # Create DataFrame
    df = pd.DataFrame(orders)
    df['placedAt'] = pd.to_datetime(df['placedAt'])
    df['total'] = df['total'].astype(float)
    
    # 1. Summary
    summary = {
        "totalRevenue": float(df['total'].sum()),
        "orderCount": int(len(df)),
        "avgOrderValue": float(df['total'].mean())
    }

    charts = {}

    # 2. Sales Trend Chart
    plt.figure(figsize=(8, 4))
    trend = df.set_index('placedAt').resample('D')['total'].sum().reset_index()
    plt.plot(trend['placedAt'], trend['total'], color='#6366f1', linewidth=2, marker='o', markersize=4)
    plt.title('Daily Revenue Trend', fontsize=14, pad=15)
    plt.grid(True, linestyle='--', alpha=0.6)
    plt.xticks(rotation=45)
    charts['salesTrend'] = fig_to_base64(plt.gcf())
    plt.close()

    # 3. Peak Hours Chart
    plt.figure(figsize=(8, 4))
    df['hour'] = df['placedAt'].dt.hour
    hour_counts = df['hour'].value_counts().sort_index()
    plt.bar(hour_counts.index, hour_counts.values, color='#8b5cf6', alpha=0.8)
    plt.title('Peak Ordering Hours', fontsize=14, pad=15)
    plt.xlabel('Hour of Day')
    plt.ylabel('Order Count')
    plt.xticks(range(0, 24))
    charts['peakHours'] = fig_to_base64(plt.gcf())
    plt.close()

    # 4. Top Selling Items
    # Flatten items
    all_items = []
    for items_list in df['items']:
        for item in items_list:
            all_items.append({
                'name': item['name'],
                'quantity': item['quantity'],
                'lineTotal': item['lineTotal']
            })
    
    if all_items:
        items_df = pd.DataFrame(all_items)
        top_items = items_df.groupby('name')['lineTotal'].sum().sort_values(ascending=False).head(5)
        
        plt.figure(figsize=(8, 4))
        top_items.plot(kind='barh', color=plt.cm.Paired(np.arange(len(top_items))))
        plt.title('Top 5 Items (by Revenue)', fontsize=14, pad=15)
        plt.xlabel('Revenue')
        plt.gca().invert_yaxis()
        charts['topItems'] = fig_to_base64(plt.gcf())
        plt.close()

    return {
        "summary": summary,
        "charts": charts
    }

if __name__ == "__main__":
    try:
        # Args: [script_name, truck_id, days]
        args = sys.argv[1:]
        t_id = args[0] if len(args) > 0 and args[0] != 'null' else None
        d = int(args[1]) if len(args) > 1 else 30
        
        result = run_analytics(t_id, d)
        print(json.dumps({"success": True, "data": result}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
