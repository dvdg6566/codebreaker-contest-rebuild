import os
import json
import boto3
from boto3.dynamodb.conditions import Key

# Environment variables
judgeName = os.environ.get('judgeName')
accountId = os.environ.get('AWS_ACCOUNT_ID')
region = os.environ.get('AWS_REGION')

# AWS clients
dynamodb = boto3.resource('dynamodb')
sfn_client = boto3.client('stepfunctions')

# Table and Step Function references
websocket_table = dynamodb.Table(f'{judgeName}-websocket')
WEBSOCKET_STEP_FUNCTION_ARN = f'arn:aws:states:{region}:{accountId}:stateMachine:{judgeName}-websocket'

BLOCK_SIZE = 100  # Batch size for WebSocket notifications


def query_contest_connections(contest_id: str) -> list:
    """Query all WebSocket connections for a contest."""
    response = websocket_table.query(
        IndexName='contestIdUsernameIndex',
        KeyConditionExpression=Key('contestId').eq(contest_id),
        ProjectionExpression='connectionId'
    )
    return response.get('Items', [])


def query_user_connections(contest_id: str, username: str) -> list:
    """Query WebSocket connections for a specific user in a contest."""
    response = websocket_table.query(
        IndexName='contestIdUsernameIndex',
        KeyConditionExpression=Key('contestId').eq(contest_id) & Key('username').eq(username),
        ProjectionExpression='connectionId'
    )
    return response.get('Items', [])


def invoke_websocket_broadcast(items: list, contest_id: str, username: str = None):
    """Batch connections and invoke Step Function for parallel broadcasting."""
    connection_ids = [item['connectionId'] for item in items]

    # Batch into groups of BLOCK_SIZE
    batches = [connection_ids[i:i + BLOCK_SIZE] for i in range(0, len(connection_ids), BLOCK_SIZE)]

    # Step Function input: array of batches
    sf_input = json.dumps([{
        'notificationType': 'endContest',
        'connectionIds': batch,
        'contestId': contest_id,
        'username': username
    } for batch in batches])

    print(f"Invoking Step Function with {len(batches)} batches, {len(connection_ids)} total connections")

    sfn_client.start_execution(
        stateMachineArn=WEBSOCKET_STEP_FUNCTION_ARN,
        input=sf_input
    )
