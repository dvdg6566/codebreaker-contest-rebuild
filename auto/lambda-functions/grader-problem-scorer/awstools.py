import os
import boto3
import json
from datetime import datetime
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr

judgeName = os.environ['judgeName']

dynamodb = boto3.resource('dynamodb','ap-southeast-1')
problems_table = dynamodb.Table(f'{judgeName}-problems')
submissions_table = dynamodb.Table(f'{judgeName}-submissions')
users_table = dynamodb.Table(f'{judgeName}-users')
lambda_client = boto3.client('lambda')

def getProblemScores(username):
    response = users_table.query(
        ProjectionExpression = 'problemScores',
        KeyConditionExpression=Key('username').eq(username),
    )
    if len(response['Items']) != 1: return None
    return response['Items'][0]

def getProblemInfo(problemName):
    response = problems_table.query(
        KeyConditionExpression = Key('problemName').eq(problemName)
    )
    if len(response['Items']) != 1: return None
    return response['Items'][0]

def getSubmission(subId):
    response = submissions_table.query(
        KeyConditionExpression = Key('subId').eq(subId)
    )
    if len(response['Items']) != 1: return None
    return response['Items'][0]

def updateSubmission(subId, maxTime, maxMemory, subtaskScores, totalScore):
    gradingCompleteTime = datetime.utcnow().strftime("%Y-%m-%d %X")
    submissions_table.update_item(
        Key={'subId':subId},
        UpdateExpression = f'set maxTime = :a, maxMemory=:b,subtaskScores=:c,totalScore=:d,gradingCompleteTime=:e',
        ExpressionAttributeValues={':a':maxTime,':b':maxMemory,':c':subtaskScores,':d':totalScore,':e':gradingCompleteTime}
    )

def updateCE(subId, compileErrorMessage):
    gradingCompleteTime = datetime.utcnow().strftime("%Y-%m-%d %X")
    submissions_table.update_item(
        Key={'subId':subId},
        UpdateExpression = f'set compileErrorMessage = :a, gradingCompleteTime= :b',
        ExpressionAttributeValues={':a':compileErrorMessage, ':b': gradingCompleteTime}
    )

def getStitchSubmissions(username, problemName):
    # Gets list of all submissions made by user to problem
    submissions = submissions_table.query(
        IndexName = 'usernameIndex',
        KeyConditionExpression = Key('username').eq(username),
        ProjectionExpression = 'subtaskScores, score',
        FilterExpression = Attr('problemName').eq(problemName),
        ScanIndexForward = False
    )['Items']

    return submissions

def updateUserScore(username, problemName, stitchedScore, latestScoreChange):
    # First ensure problemScores field exists
    users_table.update_item(
        Key={'username': username},
        UpdateExpression='set problemScores = if_not_exists(problemScores, :empty_obj)',
        ExpressionAttributeValues={':empty_obj': {}}
    )

    # Then update the specific problem score
    users_table.update_item(
        Key = {'username' : username},
        UpdateExpression = f'set problemScores.#a =:a, latestScoreChange=:b',
        ExpressionAttributeValues={':a': stitchedScore, ':b':latestScoreChange},
        ExpressionAttributeNames={'#a':problemName}
    )

def getUserActiveContests(username):
    """Get user's active contests"""
    response = users_table.query(
        ProjectionExpression = 'activeContests',
        KeyConditionExpression=Key('username').eq(username),
    )
    if len(response['Items']) != 1:
        return {}
    return response['Items'][0].get('activeContests', {})

def updateUserContestScore(username, contestId, problemName, score):
    """Update user's contest-specific score for a problem using read-modify-write pattern"""
    try:
        score_decimal = Decimal(str(score)) if score is not None else Decimal('0')

        # Read current user contest scores
        response = users_table.query(
            ProjectionExpression='contestScores',
            KeyConditionExpression=Key('username').eq(username),
        )

        if len(response['Items']) == 1:
            current_scores = response['Items'][0].get('contestScores', {})
        else:
            current_scores = {}

        # Modify in memory
        if contestId not in current_scores:
            current_scores[contestId] = {}
        current_scores[contestId][problemName] = score_decimal

        # Write back using simple pattern
        users_table.update_item(
            Key={'username': username},
            UpdateExpression='set contestScores = :scores',
            ExpressionAttributeValues={':scores': current_scores}
        )
        print(f"Updated user contest score: {username} {contestId} {problemName} = {score_decimal}")
    except Exception as e:
        print(f"Error updating user contest score: {e}")

def updateContestScore(contestId, username, problemName, subtaskScores):
    """Update contest-level subtask scores for IOI-style scoring and derive user total score"""
    contests_table = dynamodb.Table(f'{judgeName}-contests')
    try:
        # Get current contest scores
        response = contests_table.query(
            KeyConditionExpression=Key('contestId').eq(contestId)
        )
        if len(response['Items']) != 1:
            print(f"Contest {contestId} not found")
            return

        contest = response['Items'][0]
        current_scores = contest.get('contestScores', {})
        if username not in current_scores:
            current_scores[username] = {}
        if problemName not in current_scores[username]:
            current_scores[username][problemName] = [0] * len(subtaskScores)

        # Update with max scores per subtask
        current_subtask_scores = current_scores[username][problemName]
        updated_subtask_scores = [
            int(max(current_subtask_scores[i], float(subtaskScores[i])))
            for i in range(len(subtaskScores))
        ]
        current_scores[username][problemName] = updated_subtask_scores

        # Update contest table
        contests_table.update_item(
            Key={'contestId': contestId},
            UpdateExpression='set contestScores = :scores',
            ExpressionAttributeValues={':scores': current_scores}
        )
        print(f"Updated contest scores: {contestId} {username} {problemName} = {updated_subtask_scores}")

        # Calculate total score from maxed subtask scores and update user table
        problemInfo = getProblemInfo(problemName)
        if problemInfo:
            subtaskTotalScores = problemInfo['subtaskScores']
            total_score = 0
            for i in range(len(updated_subtask_scores)):
                total_score += updated_subtask_scores[i] * subtaskTotalScores[i]
            total_score = Decimal(str(round(total_score / 100, 2)))

            # Update user table with calculated total
            updateUserContestScore(username, contestId, problemName, total_score)
        else:
            print(f"Warning: Could not get problem info for {problemName}")

    except Exception as e:
        print(f"Error updating contest score: {e}")