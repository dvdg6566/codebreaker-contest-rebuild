import unittest
from unittest.mock import Mock, patch, MagicMock
from decimal import Decimal
import sys
import os

# Mock boto3 before importing awstools
sys.modules['boto3'] = Mock()

# Mock environment variables
os.environ['judgeName'] = 'test-judge'

import awstools


class TestAWSTools(unittest.TestCase):

    def setUp(self):
        """Set up test fixtures"""
        # Mock DynamoDB tables
        self.mock_users_table = Mock()
        self.mock_contests_table = Mock()
        self.mock_problems_table = Mock()

        # Patch the table instances
        self.users_patcher = patch.object(awstools, 'users_table', self.mock_users_table)
        self.contests_patcher = patch.object(awstools, 'contests_table', self.mock_contests_table)
        self.problems_patcher = patch.object(awstools, 'problems_table', self.mock_problems_table)

        self.users_patcher.start()
        self.contests_patcher.start()
        self.problems_patcher.start()

    def tearDown(self):
        """Clean up patches"""
        self.users_patcher.stop()
        self.contests_patcher.stop()
        self.problems_patcher.stop()

    @patch('awstools.dynamodb')
    def test_updateUserContestScore_new_user(self, mock_dynamodb):
        """Test updating contest score for user with no existing contest scores"""
        # Setup
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.query.return_value = {'Items': []}

        # Execute
        awstools.updateUserContestScore('alice', 'contest-123', 'addition', Decimal('100.0'))

        # Verify query was called
        mock_table.query.assert_called_once_with(
            ProjectionExpression='contestScores',
            KeyConditionExpression=unittest.mock.ANY
        )

        # Verify update was called with correct structure
        mock_table.update_item.assert_called_once()
        call_args = mock_table.update_item.call_args
        self.assertEqual(call_args[1]['Key'], {'username': 'alice'})
        self.assertEqual(call_args[1]['UpdateExpression'], 'set contestScores = :scores')

        expected_scores = {
            'contest-123': {
                'addition': Decimal('100.0')
            }
        }
        self.assertEqual(call_args[1]['ExpressionAttributeValues'][':scores'], expected_scores)

    @patch('awstools.dynamodb')
    def test_updateUserContestScore_existing_user(self, mock_dynamodb):
        """Test updating contest score for user with existing contest scores"""
        # Setup
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        existing_scores = {
            'contest-123': {
                'ping': Decimal('40.0')
            },
            'contest-456': {
                'addition': Decimal('80.0')
            }
        }
        mock_table.query.return_value = {
            'Items': [{'contestScores': existing_scores}]
        }

        # Execute
        awstools.updateUserContestScore('alice', 'contest-123', 'addition', Decimal('100.0'))

        # Verify update preserves existing scores and adds new one
        call_args = mock_table.update_item.call_args
        expected_scores = {
            'contest-123': {
                'ping': Decimal('40.0'),
                'addition': Decimal('100.0')  # New score added
            },
            'contest-456': {
                'addition': Decimal('80.0')  # Preserved
            }
        }
        self.assertEqual(call_args[1]['ExpressionAttributeValues'][':scores'], expected_scores)

    @patch('awstools.dynamodb')
    @patch('awstools.getProblemInfo')
    @patch('awstools.updateUserContestScore')
    def test_updateContestScore_new_contest(self, mock_update_user, mock_get_problem, mock_dynamodb):
        """Test updating contest score for new contest"""
        # Setup
        mock_contests_table = Mock()
        mock_dynamodb.Table.return_value = mock_contests_table

        # Mock contest query response
        mock_contests_table.query.return_value = {
            'Items': [{'contestId': 'contest-123', 'contestScores': {}}]
        }

        # Mock problem info
        mock_get_problem.return_value = {
            'subtaskScores': [40, 30, 20, 10]  # Sums to 100
        }

        # Execute
        subtask_scores = [100, 50, 0, 75]
        awstools.updateContestScore('contest-123', 'alice', 'addition', subtask_scores)

        # Verify contest table update
        call_args = mock_contests_table.update_item.call_args
        expected_contest_scores = {
            'alice': {
                'addition': [100, 50, 0, 75]  # Max with [0,0,0,0] = original scores
            }
        }
        self.assertEqual(call_args[1]['ExpressionAttributeValues'][':scores'], expected_contest_scores)

        # Verify user table update was called with correct total
        # Total = (100*40 + 50*30 + 0*20 + 75*10) / 100 = 62.5
        mock_update_user.assert_called_once_with(
            'alice', 'contest-123', 'addition', Decimal('62.5')
        )

    @patch('awstools.dynamodb')
    @patch('awstools.getProblemInfo')
    @patch('awstools.updateUserContestScore')
    def test_updateContestScore_max_logic(self, mock_update_user, mock_get_problem, mock_dynamodb):
        """Test max logic for IOI-style scoring"""
        # Setup
        mock_contests_table = Mock()
        mock_dynamodb.Table.return_value = mock_contests_table

        # Mock contest with existing scores
        existing_contest_scores = {
            'alice': {
                'addition': [80, 100, 20, 90]  # Previous submission scores
            }
        }
        mock_contests_table.query.return_value = {
            'Items': [{'contestId': 'contest-123', 'contestScores': existing_contest_scores}]
        }

        # Mock problem info
        mock_get_problem.return_value = {
            'subtaskScores': [35, 30, 25, 10]  # Sums to 100
        }

        # Execute with new submission
        new_subtask_scores = [60, 80, 100, 95]  # Some better, some worse
        awstools.updateContestScore('contest-123', 'alice', 'addition', new_subtask_scores)

        # Verify max logic: [max(80,60), max(100,80), max(20,100), max(90,95)]
        call_args = mock_contests_table.update_item.call_args
        expected_contest_scores = {
            'alice': {
                'addition': [80, 100, 100, 95]  # Maxed scores
            }
        }
        self.assertEqual(call_args[1]['ExpressionAttributeValues'][':scores'], expected_contest_scores)

        # Verify user table update with maxed total
        # Total = (80*35 + 100*30 + 100*25 + 95*10) / 100 = 91.3
        mock_update_user.assert_called_once_with(
            'alice', 'contest-123', 'addition', Decimal('91.3')
        )

    @patch('awstools.dynamodb')
    def test_updateContestScore_contest_not_found(self, mock_dynamodb):
        """Test handling when contest doesn't exist"""
        # Setup
        mock_contests_table = Mock()
        mock_dynamodb.Table.return_value = mock_contests_table
        mock_contests_table.query.return_value = {'Items': []}  # No contest found

        # Execute
        result = awstools.updateContestScore('nonexistent-contest', 'alice', 'addition', [100, 50, 0, 75])

        # Verify early return and no updates
        self.assertIsNone(result)
        mock_contests_table.update_item.assert_not_called()

    @patch('awstools.getProblemInfo')
    def test_updateContestScore_problem_info_not_found(self, mock_get_problem):
        """Test handling when problem info can't be retrieved"""
        # Setup
        mock_get_problem.return_value = None

        with patch('awstools.dynamodb') as mock_dynamodb:
            mock_contests_table = Mock()
            mock_dynamodb.Table.return_value = mock_contests_table
            mock_contests_table.query.return_value = {
                'Items': [{'contestId': 'contest-123', 'contestScores': {}}]
            }

            with patch('awstools.updateUserContestScore') as mock_update_user:
                # Execute
                awstools.updateContestScore('contest-123', 'alice', 'addition', [100, 50, 0, 75])

                # Verify contest table is still updated but user table is not
                mock_contests_table.update_item.assert_called_once()
                mock_update_user.assert_not_called()

    def test_decimal_handling(self):
        """Test that various numeric types are properly converted to Decimal"""
        with patch('awstools.dynamodb') as mock_dynamodb:
            mock_table = Mock()
            mock_dynamodb.Table.return_value = mock_table
            mock_table.query.return_value = {'Items': []}

            # Test different input types
            test_cases = [
                (100, Decimal('100')),
                (100.5, Decimal('100.5')),
                ('100.25', Decimal('100.25')),
                (Decimal('99.99'), Decimal('99.99'))
            ]

            for input_score, expected_decimal in test_cases:
                mock_table.reset_mock()

                awstools.updateUserContestScore('alice', 'contest-123', 'addition', input_score)

                call_args = mock_table.update_item.call_args
                actual_score = call_args[1]['ExpressionAttributeValues'][':scores']['contest-123']['addition']
                self.assertEqual(actual_score, expected_decimal)
                self.assertIsInstance(actual_score, Decimal)


class TestIntegration(unittest.TestCase):
    """Integration tests that test the full flow"""

    @patch('awstools.dynamodb')
    @patch('awstools.getProblemInfo')
    def test_full_contest_scoring_flow(self, mock_get_problem, mock_dynamodb):
        """Test the complete flow of contest scoring"""
        # Setup mocks
        mock_contests_table = Mock()
        mock_users_table = Mock()

        def table_factory(table_name):
            if 'contests' in table_name:
                return mock_contests_table
            elif 'users' in table_name:
                return mock_users_table
            return Mock()

        mock_dynamodb.Table.side_effect = table_factory

        # Mock contest table response
        mock_contests_table.query.return_value = {
            'Items': [{'contestId': 'contest-123', 'contestScores': {}}]
        }

        # Mock users table response
        mock_users_table.query.return_value = {'Items': []}

        # Mock problem info
        mock_get_problem.return_value = {
            'subtaskScores': [50, 30, 20]  # Sums to 100
        }

        # Execute contest scoring
        subtask_scores = [100, 60, 80]
        awstools.updateContestScore('contest-123', 'alice', 'ping', subtask_scores)

        # Verify contest table was updated
        contest_call = mock_contests_table.update_item.call_args
        expected_contest_scores = {
            'alice': {
                'ping': [100, 60, 80]
            }
        }
        self.assertEqual(contest_call[1]['ExpressionAttributeValues'][':scores'], expected_contest_scores)

        # Verify users table was updated with calculated total
        users_call = mock_users_table.update_item.call_args
        expected_user_scores = {
            'contest-123': {
                'ping': Decimal('84.0')  # (100*50 + 60*30 + 80*20) / 100
            }
        }
        self.assertEqual(users_call[1]['ExpressionAttributeValues'][':scores'], expected_user_scores)


if __name__ == '__main__':
    unittest.main()