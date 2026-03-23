"""
CloudFormation Custom Resource Lambda for deploying webapp via App Runner.

This Lambda:
1. On Create: Triggers CodeBuild, creates App Runner service, initializes sample data
2. On Update: Triggers CodeBuild, updates App Runner service
3. On Delete: Deletes App Runner service
"""

import boto3
import time
import json
import os
import secrets
import urllib.request

from init_data import initialize_sample_data

# AWS Clients
codebuild = boto3.client('codebuild')
apprunner = boto3.client('apprunner')
sts = boto3.client('sts')

# Environment variables
JUDGE_NAME = os.environ.get('JUDGE_NAME', '')
REGION = os.environ.get('AWS_REGION', 'ap-southeast-1')


def send_response(event, context, status, data=None, reason=None):
    """Send response to CloudFormation pre-signed URL."""
    response_body = {
        'Status': status,
        'Reason': reason or f'See CloudWatch Log Stream: {context.log_stream_name}',
        'PhysicalResourceId': event.get('PhysicalResourceId', context.log_stream_name),
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'Data': data or {}
    }

    response_body_json = json.dumps(response_body).encode('utf-8')

    req = urllib.request.Request(
        event['ResponseURL'],
        data=response_body_json,
        headers={'Content-Type': 'application/json'},
        method='PUT'
    )

    urllib.request.urlopen(req)


def wait_for_build(build_id, max_attempts=180):
    """Poll CodeBuild until build completes. Max ~30 minutes."""
    for attempt in range(max_attempts):
        time.sleep(10)

        response = codebuild.batch_get_builds(ids=[build_id])
        build = response['builds'][0]
        status = build['buildStatus']

        print(f'Build status (attempt {attempt + 1}): {status}')

        if status == 'SUCCEEDED':
            return True, status
        elif status in ['FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT']:
            return False, status

    return False, 'TIMEOUT'


def create_app_runner_service(judge_name, image_uri, access_role_arn, instance_role_arn, properties):
    """Create App Runner service."""
    service_name = f'{judge_name}-webapp'

    # Generate session secret
    session_secret = secrets.token_hex(32)

    response = apprunner.create_service(
        ServiceName=service_name,
        SourceConfiguration={
            'ImageRepository': {
                'ImageIdentifier': image_uri,
                'ImageRepositoryType': 'ECR',
                'ImageConfiguration': {
                    'Port': '3000',
                    'RuntimeEnvironmentVariables': {
                        'JUDGE_NAME': judge_name,
                        'AWS_REGION': REGION,
                        'COGNITO_USER_POOL_ID': properties['CognitoUserPoolId'],
                        'COGNITO_CLIENT_ID': properties['CognitoClientId'],
                        'API_GATEWAY_LINK': properties['WebSocketEndpoint'],
                        'SESSION_SECRET': session_secret,
                        'NODE_ENV': 'production'
                    }
                }
            },
            'AutoDeploymentsEnabled': False,
            'AuthenticationConfiguration': {
                'AccessRoleArn': access_role_arn
            }
        },
        InstanceConfiguration={
            'Cpu': '1 vCPU',
            'Memory': '2 GB',
            'InstanceRoleArn': instance_role_arn
        },
        HealthCheckConfiguration={
            'Protocol': 'HTTP',
            'Path': '/',
            'Interval': 10,
            'Timeout': 5,
            'HealthyThreshold': 1,
            'UnhealthyThreshold': 5
        },
        AutoScalingConfigurationArn=get_or_create_autoscaling_config(judge_name)
    )

    service_arn = response['Service']['ServiceArn']
    print(f'Created App Runner service: {service_arn}')

    # Wait for service to be running
    service_url = wait_for_service_running(service_arn)

    return service_arn, service_url


def get_or_create_autoscaling_config(judge_name):
    """Get or create auto-scaling configuration."""
    config_name = f'{judge_name}-webapp-autoscaling'

    # Try to find existing config
    try:
        response = apprunner.list_auto_scaling_configurations(
            AutoScalingConfigurationName=config_name,
            LatestOnly=True
        )
        if response['AutoScalingConfigurationSummaryList']:
            return response['AutoScalingConfigurationSummaryList'][0]['AutoScalingConfigurationArn']
    except Exception:
        pass

    # Create new config
    response = apprunner.create_auto_scaling_configuration(
        AutoScalingConfigurationName=config_name,
        MaxConcurrency=100,
        MinSize=1,
        MaxSize=25
    )

    return response['AutoScalingConfiguration']['AutoScalingConfigurationArn']


def wait_for_service_running(service_arn, max_attempts=60):
    """Wait for App Runner service to be running."""
    for attempt in range(max_attempts):
        time.sleep(10)

        response = apprunner.describe_service(ServiceArn=service_arn)
        status = response['Service']['Status']

        print(f'App Runner status (attempt {attempt + 1}): {status}')

        if status == 'RUNNING':
            return f"https://{response['Service']['ServiceUrl']}"
        elif status in ['CREATE_FAILED', 'DELETE_FAILED', 'DELETED']:
            raise Exception(f'App Runner service failed with status: {status}')

    raise Exception('App Runner service creation timed out')


def delete_app_runner_service(judge_name):
    """Delete App Runner service."""
    service_name = f'{judge_name}-webapp'

    # Find the service
    try:
        response = apprunner.list_services()
        for service in response['ServiceSummaryList']:
            if service['ServiceName'] == service_name:
                print(f'Deleting App Runner service: {service["ServiceArn"]}')
                apprunner.delete_service(ServiceArn=service['ServiceArn'])
                return

        print(f'Service {service_name} not found, skipping delete')
    except Exception as e:
        print(f'Error deleting service: {e}')


def lambda_handler(event, context):
    print(f'Received event: {json.dumps(event)}')

    request_type = event['RequestType']
    properties = event['ResourceProperties']

    project_name = properties['ProjectName']
    judge_name = properties['JudgeName']
    admin_email = properties['AdminEmail']
    image_uri = properties['ImageUri']
    access_role_arn = properties['AppRunnerAccessRoleArn']
    instance_role_arn = properties['AppRunnerInstanceRoleArn']

    try:
        if request_type == 'Delete':
            delete_app_runner_service(judge_name)
            send_response(event, context, 'SUCCESS')
            return

        # Create or Update
        print(f'Starting CodeBuild project: {project_name}')
        build_response = codebuild.start_build(projectName=project_name)
        build_id = build_response['build']['id']
        print(f'Build started: {build_id}')

        # Wait for build to complete
        success, status = wait_for_build(build_id)

        if not success:
            send_response(event, context, 'FAILED',
                         reason=f'CodeBuild failed with status: {status}')
            return

        print('CodeBuild completed successfully')

        # Create App Runner service
        print('Creating App Runner service...')
        service_arn, service_url = create_app_runner_service(
            judge_name, image_uri, access_role_arn, instance_role_arn, properties
        )

        # Initialize sample data (only on Create)
        if request_type == 'Create':
            print('Initializing sample data...')
            initialize_sample_data(
                judge_name=judge_name,
                admin_email=admin_email,
                user_pool_id=properties['CognitoUserPoolId'],
                region=REGION
            )

        send_response(event, context, 'SUCCESS', {
            'BuildId': build_id,
            'AppRunnerServiceArn': service_arn,
            'AppRunnerServiceUrl': service_url
        })

    except Exception as e:
        print(f'Error: {str(e)}')
        import traceback
        traceback.print_exc()
        send_response(event, context, 'FAILED', reason=str(e))
