import json
import awstools

def lambda_handler(event, context):

    notificationType = event['notificationType']
    # Notification type is either announce (all users) or clarification (admin only)
    connectionIds = event['connectionIds']

    body = {'notificationType': notificationType}

    # Include additional fields for endContest notifications
    if notificationType == 'endContest':
        if 'contestId' in event:
            body['contestId'] = event['contestId']
        if 'username' in event and event['username']:
            body['username'] = event['username']

    for connectionId in connectionIds:
        awstools.invoke(connectionId, body)

    return {'status':200}

'''
Structure of event:
{
    'notificationType': 'announce',
    'connectionIds': [
        'A','B'
    ]
}

For endContest:
{
    'notificationType': 'endContest',
    'connectionIds': ['A','B'],
    'contestId': 'contest123',
    'username': 'user123'  # Optional, only for self-timer mode
}
'''