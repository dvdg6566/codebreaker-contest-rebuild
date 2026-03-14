"""
Contest End Notifier Lambda

Invoked by EventBridge Scheduler when a contest ends (centralized or self-timer).
Queries WebSocket connections and triggers Step Function to broadcast notifications.
"""

import awstools


def lambda_handler(event, context):
    """
    Handle contest end notification.

    Event structure:
    {
        "contestId": "contest123",
        "mode": "centralized" | "self-timer",
        "username": "user123"  # Only present for self-timer mode
    }
    """
    contest_id = event['contestId']
    mode = event['mode']
    username = event.get('username')  # None for centralized mode

    print(f"Contest end notification: contestId={contest_id}, mode={mode}, username={username}")

    # Query WebSocket connections based on mode
    if mode == 'self-timer' and username:
        items = awstools.query_user_connections(contest_id, username)
    else:
        items = awstools.query_contest_connections(contest_id)

    if not items:
        print(f"No active connections found for contestId={contest_id}")
        return {'statusCode': 200, 'message': 'No connections to notify'}

    # Invoke Step Function to broadcast notifications
    awstools.invoke_websocket_broadcast(items, contest_id, username)

    return {
        'statusCode': 200,
        'message': f'Notified {len(items)} connections'
    }
