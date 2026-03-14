import os
import boto3
from time import time
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
judgeName = os.environ['judgeName']
webSocketTable = dynamodb.Table(f'{judgeName}-websocket')

def addConnection(connectionId, accountRole='member', username='placeholder', contestId=''):
    # Timedelta 5h = 5 hours * 60 minutes per hour * 60 seconds per minute
    expiryTime = int(time()) + 5 * 60 * 60

    connection = {
        'connectionId': connectionId,
        'accountRole': accountRole,
        'username': username,
        'contestId': contestId,
        'expiryTime': expiryTime
    }

    webSocketTable.put_item(Item = connection)
    
def removeConnection(connectionId):
    try:
        resp = webSocketTable.delete_item(
            Key = {'connectionId': connectionId}
        )
    except Exception as e:
        print(e)

def updateUserDetails(connectionId, username, accountRole, contestId=''):
    webSocketTable.update_item(
        Key = {'connectionId': connectionId},
        UpdateExpression = 'set username=:u, accountRole=:r, contestId=:c',
        ExpressionAttributeValues = {':u': username, ':r': accountRole, ':c': contestId}
    )