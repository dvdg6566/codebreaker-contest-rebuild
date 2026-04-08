#!/usr/bin/env python3
"""
Unit tests for grader-problem-init Lambda function

Tests the contestId handling functionality to ensure contest-specific scoring
works correctly.
"""

import sys
import os
import unittest
from unittest.mock import patch, MagicMock

# Add the lambda directory to the path to import the function
sys.path.insert(0, os.path.dirname(__file__))

# Mock awstools module before importing lambda_function
sys.modules['awstools'] = MagicMock()

import lambda_function


class TestGraderProblemInit(unittest.TestCase):
    """Test cases for grader-problem-init Lambda function"""

    def setUp(self):
        """Set up test fixtures"""
        self.base_event = {
            'problemName': 'test-problem',
            'submissionId': 123,
            'username': 'testuser',
            'submissionTime': '2024-01-01 12:00:00',
            'language': 'cpp'
        }

        self.mock_problem_info = {
            'timeLimit': '2',
            'memoryLimit': '1024',
            'subtaskDependency': ['1', '2-3'],
            'subtaskScores': [50, 50],
            'testcaseCount': '3',
            'customChecker': '0'
        }

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_contest_submission_includes_contestid(self, mock_get_problem, mock_upload):
        """Test that contest submissions correctly include contestId in output"""
        mock_get_problem.return_value = self.mock_problem_info

        # Event with contestId
        event = {**self.base_event, 'contestId': 'contest-123'}

        result = lambda_function.lambda_handler(event, None)

        # Verify contestId is included in output
        self.assertEqual(result['contestId'], 'contest-123')
        self.assertEqual(result['status'], 200)
        self.assertEqual(result['username'], 'testuser')
        self.assertEqual(len(result['payloads']), 3)  # 3 testcases

        # Verify submission was uploaded
        mock_upload.assert_called_once()

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_global_submission_includes_none_contestid(self, mock_get_problem, mock_upload):
        """Test that submissions without contestId have None in output"""
        mock_get_problem.return_value = self.mock_problem_info

        # Event without contestId
        event = self.base_event

        result = lambda_function.lambda_handler(event, None)

        # Verify contestId is None when not provided
        self.assertIsNone(result['contestId'])
        self.assertEqual(result['status'], 200)
        self.assertEqual(result['username'], 'testuser')

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_global_submission_with_explicit_global(self, mock_get_problem, mock_upload):
        """Test that global submissions with explicit 'global' contestId work"""
        mock_get_problem.return_value = self.mock_problem_info

        # Event with explicit 'global' contestId
        event = {**self.base_event, 'contestId': 'global'}

        result = lambda_function.lambda_handler(event, None)

        # Verify contestId is 'global'
        self.assertEqual(result['contestId'], 'global')
        self.assertEqual(result['status'], 200)

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_payloads_structure_unchanged(self, mock_get_problem, mock_upload):
        """Test that payload structure for testcases remains unchanged"""
        mock_get_problem.return_value = self.mock_problem_info

        event = {**self.base_event, 'contestId': 'contest-123'}

        result = lambda_function.lambda_handler(event, None)

        # Verify payload structure for each testcase
        expected_payload_keys = {
            'problemName', 'submissionId', 'testcaseNumber',
            'memoryLimit', 'timeLimit', 'customChecker', 'language'
        }

        for i, payload in enumerate(result['payloads']):
            self.assertEqual(set(payload.keys()), expected_payload_keys)
            self.assertEqual(payload['testcaseNumber'], i + 1)
            self.assertEqual(payload['problemName'], 'test-problem')
            self.assertEqual(payload['submissionId'], 123)
            self.assertEqual(payload['language'], 'cpp')

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_submission_upload_unchanged(self, mock_get_problem, mock_upload):
        """Test that submission upload logic is not affected by contestId changes"""
        mock_get_problem.return_value = self.mock_problem_info

        event = {**self.base_event, 'contestId': 'contest-123'}

        lambda_function.lambda_handler(event, None)

        # Verify submission upload was called with correct structure
        mock_upload.assert_called_once()
        upload_args = mock_upload.call_args[0][0]

        expected_fields = {
            'subId', 'submissionTime', 'gradingTime', 'gradingCompleteTime',
            'username', 'maxMemory', 'maxTime', 'problemName', 'score',
            'verdicts', 'times', 'memories', 'returnCodes', 'subtaskScores',
            'status', 'totalScore', 'language'
        }

        self.assertEqual(set(upload_args.keys()), expected_fields)
        self.assertEqual(upload_args['subId'], 123)
        self.assertEqual(upload_args['username'], 'testuser')

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_empty_string_contestid(self, mock_get_problem, mock_upload):
        """Test handling of empty string contestId"""
        mock_get_problem.return_value = self.mock_problem_info

        event = {**self.base_event, 'contestId': ''}

        result = lambda_function.lambda_handler(event, None)

        # Empty string should be preserved (not converted to None)
        self.assertEqual(result['contestId'], '')

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_problem_info_parsing(self, mock_get_problem, mock_upload):
        """Test that problem info parsing works correctly with contestId"""
        # Test with empty limits (should use defaults)
        mock_problem_info = {
            'timeLimit': '',
            'memoryLimit': '',
            'subtaskDependency': ['1'],
            'subtaskScores': [100],
            'testcaseCount': '1',
            'customChecker': '1'
        }
        mock_get_problem.return_value = mock_problem_info

        event = {**self.base_event, 'contestId': 'contest-123'}

        result = lambda_function.lambda_handler(event, None)

        # Verify defaults are applied
        payload = result['payloads'][0]
        self.assertEqual(payload['memoryLimit'], 1024.0)  # Default memory limit
        self.assertEqual(payload['timeLimit'], 1.0)       # Default time limit
        self.assertEqual(payload['customChecker'], 1)     # Custom checker enabled


class TestContestIdCompatibility(unittest.TestCase):
    """Test backwards compatibility and edge cases for contestId"""

    def setUp(self):
        self.base_event = {
            'problemName': 'test-problem',
            'submissionId': 456,
            'username': 'testuser2',
            'submissionTime': '2024-01-01 12:00:00',
            'language': 'py'
        }

        self.mock_problem_info = {
            'timeLimit': '3',
            'memoryLimit': '512',
            'subtaskDependency': ['1-2'],
            'subtaskScores': [100],
            'testcaseCount': '2',
            'customChecker': '0'
        }

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_backwards_compatibility_no_contestid(self, mock_get_problem, mock_upload):
        """Test that existing submissions without contestId continue to work"""
        mock_get_problem.return_value = self.mock_problem_info

        # Event with no contestId (as before the change)
        event = self.base_event

        result = lambda_function.lambda_handler(event, None)

        # Should work exactly as before
        self.assertEqual(result['status'], 200)
        self.assertEqual(result['username'], 'testuser2')
        self.assertIsNone(result['contestId'])
        self.assertEqual(len(result['payloads']), 2)

    @patch('awstools.uploadSubmission')
    @patch('awstools.getProblemInfo')
    def test_various_contestid_formats(self, mock_get_problem, mock_upload):
        """Test various contestId formats that might be encountered"""
        mock_get_problem.return_value = self.mock_problem_info

        test_cases = [
            'contest-uuid-123',
            'global',
            'CONTEST_2024_FINAL',
            'test-contest-1',
            '123',
            'a' * 50  # Long contest ID
        ]

        for contest_id in test_cases:
            with self.subTest(contestId=contest_id):
                event = {**self.base_event, 'contestId': contest_id}
                result = lambda_function.lambda_handler(event, None)

                self.assertEqual(result['contestId'], contest_id)
                self.assertEqual(result['status'], 200)


if __name__ == '__main__':
    # Configure test runner
    unittest.main(verbosity=2, buffer=True)