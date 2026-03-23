# One-Click Deployment Plan

## Overview

This plan covers two features:
1. **Password reset flow** - Handle Cognito `NEW_PASSWORD_REQUIRED` challenge for first login
2. **One-click deployment** - Deploy entire application via CloudFormation Quick Create link

---

## Part 1: First-Login Password Change

### Context
When admin user is created via Cognito email invite, they receive a temporary password. On first login, Cognito returns `NEW_PASSWORD_REQUIRED` challenge instead of auth tokens. The app must handle this by prompting for a new password.

### Current Flow
```
User enters temp password → authenticate() → Cognito returns challenge → authenticate() throws error → "Invalid username or password"
```

### New Flow
```
User enters temp password → authenticate() → Cognito returns challenge → Return challenge info → Show "Set New Password" form → completeNewPasswordChallenge() → Cognito returns tokens → Login successful
```

### Files to Modify

#### 1. `/app/lib/cognito.server.ts`

**Add imports:**
```typescript
import { RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider";
```

**Modify `authenticate()` to return challenge info:**
```typescript
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

export interface AuthChallenge {
  challengeName: "NEW_PASSWORD_REQUIRED";
  session: string;
  username: string;
}

export type AuthResponse =
  | { type: "success"; result: AuthResult }
  | { type: "challenge"; challenge: AuthChallenge };

export async function authenticate(
  username: string,
  password: string
): Promise<AuthResponse> {
  const command = new InitiateAuthCommand({...});
  const response = await client.send(command);

  // Check for challenge
  if (response.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    return {
      type: "challenge",
      challenge: {
        challengeName: "NEW_PASSWORD_REQUIRED",
        session: response.Session!,
        username,
      },
    };
  }

  // Normal auth success
  if (!response.AuthenticationResult) {
    throw new Error("Authentication failed");
  }

  return {
    type: "success",
    result: {
      accessToken: response.AuthenticationResult.AccessToken!,
      refreshToken: response.AuthenticationResult.RefreshToken!,
      idToken: response.AuthenticationResult.IdToken!,
      expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
    },
  };
}
```

**Add `completeNewPasswordChallenge()`:**
```typescript
export async function completeNewPasswordChallenge(
  username: string,
  newPassword: string,
  session: string
): Promise<AuthResult> {
  const command = new RespondToAuthChallengeCommand({
    ClientId: config.clientId,
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    Session: session,
    ChallengeResponses: {
      USERNAME: username,
      NEW_PASSWORD: newPassword,
    },
  });

  const response = await client.send(command);

  if (!response.AuthenticationResult) {
    throw new Error("Failed to complete password challenge");
  }

  return {
    accessToken: response.AuthenticationResult.AccessToken!,
    refreshToken: response.AuthenticationResult.RefreshToken!,
    idToken: response.AuthenticationResult.IdToken!,
    expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
  };
}
```

#### 2. `/app/lib/auth.server.ts`

**Update `login()` to handle challenges:**
```typescript
export type LoginResult =
  | { type: "success"; cookie: string }
  | { type: "challenge"; challenge: AuthChallenge };

export async function login(
  username: string,
  password: string,
  rememberMe = false
): Promise<LoginResult> {
  const authResponse = await authenticate(username, password);

  if (authResponse.type === "challenge") {
    return { type: "challenge", challenge: authResponse.challenge };
  }

  // Continue with session creation...
  const session = createSessionFromAuth(authResponse.result, username, rememberMe);
  return { type: "success", cookie: session.cookie };
}
```

**Add `completePasswordChange()`:**
```typescript
export async function completePasswordChange(
  username: string,
  newPassword: string,
  session: string,
  rememberMe = false
): Promise<{ cookie: string }> {
  const authResult = await completeNewPasswordChallenge(username, newPassword, session);
  const sessionData = createSessionFromAuth(authResult, username, rememberMe);
  return { cookie: sessionData.cookie };
}
```

#### 3. `/app/routes/login.tsx`

**Add state for challenge handling:**
```typescript
const [challengeState, setChallengeState] = useState<{
  session: string;
  username: string;
} | null>(null);
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
```

**Update action to return challenge info:**
```typescript
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "login") {
    // Normal login
    const result = await login(username, password, rememberMe);
    if (result.type === "challenge") {
      return { challenge: result.challenge };
    }
    return redirect("/", { headers: { "Set-Cookie": result.cookie } });
  }

  if (intent === "set-password") {
    // Complete password challenge
    const session = formData.get("session") as string;
    const newPassword = formData.get("newPassword") as string;
    const { cookie } = await completePasswordChange(username, newPassword, session, rememberMe);
    return redirect("/", { headers: { "Set-Cookie": cookie } });
  }
}
```

**Add password change form (shown when challenge returned):**
```tsx
{actionData?.challenge ? (
  <Form method="post" className="space-y-4">
    <input type="hidden" name="intent" value="set-password" />
    <input type="hidden" name="session" value={actionData.challenge.session} />
    <input type="hidden" name="username" value={actionData.challenge.username} />

    <div className="p-3 text-sm text-amber-700 bg-amber-50 rounded-lg">
      Please set a new password to continue.
    </div>

    <div className="space-y-2">
      <Label htmlFor="newPassword">New Password</Label>
      <Input id="newPassword" name="newPassword" type="password" required />
    </div>

    <div className="space-y-2">
      <Label htmlFor="confirmPassword">Confirm Password</Label>
      <Input id="confirmPassword" name="confirmPassword" type="password" required />
    </div>

    <Button type="submit" className="w-full">Set Password & Sign In</Button>
  </Form>
) : (
  // Normal login form
)}
```

### Verification
1. Create user with temp password via Cognito console or CLI
2. Try to login with temp password
3. Verify "Set New Password" form appears
4. Enter new password
5. Verify login succeeds and redirect to home

---

## Part 2: One-Click Deployment

### Context
Backend infrastructure deploys via CloudFormation, but React Router app has no automated hosting. Goal: single Quick Create link deploys everything including sample data.

### Solution
Add AWS App Runner via CodeBuild Custom Resource:
1. CloudFormation creates ECR repo + CodeBuild project
2. Custom Resource Lambda:
   - Triggers CodeBuild → builds Docker → pushes to ECR
   - Creates App Runner service with env vars
   - Creates admin user (Cognito email invite)
   - Creates test users + sample problems + contest

### Files to Create

#### 1. `/buildspec-webapp.yml`
```yaml
version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
  build:
    commands:
      - docker build -t $IMAGE_REPO_NAME:latest .
      - docker tag $IMAGE_REPO_NAME:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest
  post_build:
    commands:
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest
```

#### 2. `/auto/templates/apprunner.yml`

New nested stack with:
- `WebAppECRRepository` - ECR repo for webapp
- `WebAppCodeBuildProject` - Builds Docker from GitHub
- `AppRunnerAccessRole` - For App Runner to pull from ECR
- `AppRunnerInstanceRole` - Runtime permissions
- `WebAppDeployFunction` - Custom Resource Lambda
- `WebAppDeploy` - Custom::WebAppDeploy resource

Parameters: `JudgeName`, `AdminEmail`, `CognitoUserPoolId`, `CognitoClientId`, `WebSocketEndpoint`

Outputs: `AppRunnerServiceUrl`

#### 3. `/auto/lambda-functions/webapp-deploy-trigger/`

```
webapp-deploy-trigger/
├── lambda_function.py
├── init_data.py
└── problems/           # Bundled sample problems (~1.2MB)
    ├── addition/
    ├── ping/
    └── prisoners/
```

**Lambda responsibilities (on Create):**
1. Start CodeBuild, wait for completion (~5 min)
2. Create App Runner service with env vars (~5 min)
3. Create admin user in Cognito (email invite)
4. Create test users (alice, bob, charlie, diana)
5. Upload bundled problems to S3
6. Create DynamoDB entries (problems, users, contest)
7. Compile checkers via compiler Lambda

### Files to Modify

#### 4. `/auto/template.yml`

Add parameter:
```yaml
AdminEmail:
  Type: String
  Description: "Email for admin account (receives temp password)"
```

Add nested stack:
```yaml
AppRunnerStack:
  Type: AWS::CloudFormation::Stack
  DependsOn: [CognitoStack, WebSocketStack, CodeBuildStack]
  Properties:
    TemplateURL: templates/apprunner.yml
    Parameters:
      JudgeName: !Ref JudgeName
      AdminEmail: !Ref AdminEmail
      CognitoUserPoolId: !GetAtt CognitoStack.Outputs.UserPoolId
      CognitoClientId: !GetAtt CognitoStack.Outputs.UserPoolClientId
      WebSocketEndpoint: !GetAtt WebSocketStack.Outputs.GatewayEndpoint
```

Add output:
```yaml
WebAppUrl:
  Value: !GetAtt AppRunnerStack.Outputs.AppRunnerServiceUrl
```

### User Experience

1. User clicks CloudFormation Quick Create link
2. Fills in: Stack name, JudgeName, AdminEmail
3. Clicks "Create stack"
4. ~15 min later:
   - All infrastructure deployed
   - App running at App Runner URL
   - Admin receives email with temp password
   - Sample problems and contest ready
5. Admin logs in → sees "Set New Password" form → sets password → done

### Verification
1. `sam validate` on all templates
2. Deploy to test account
3. Verify App Runner URL loads
4. Check admin email received
5. Login with temp password → set new password
6. Verify sample data exists

---

## Implementation Order

1. **Part 1: Password reset** (prerequisite for Part 2)
   - Modify cognito.server.ts
   - Modify auth.server.ts
   - Modify login.tsx

2. **Part 2: One-click deployment**
   - Create buildspec-webapp.yml
   - Create apprunner.yml template
   - Create webapp-deploy-trigger Lambda
   - Modify template.yml
   - Test deployment
