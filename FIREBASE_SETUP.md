# Firebase Setup for Group Expense Sharing

## Deploying Firestore Rules and Indexes

To deploy the Firestore security rules and indexes for the group expense sharing feature:

### Prerequisites
1. Firebase CLI is already installed as a dev dependency
2. Login to Firebase: `npm run firebase:login`
3. Initialize Firebase in your project: `npm run firebase:init`

### Deploy Rules and Indexes
```bash
# Deploy Firestore security rules
npm run firebase:deploy:rules

# Deploy Firestore indexes
npm run firebase:deploy:indexes

# Or deploy both at once
npm run firebase:deploy
```

### What the Rules Do

The Firestore security rules ensure:

1. **User Data Isolation**: Users can only access their own wallets, transactions, budgets, etc.
2. **Group Access Control**: Only group members can read group data and expenses
3. **Group Management**: Only group owners can delete groups, but any member can add expenses
4. **Settlement Security**: Only group members can view and update settlements

### Key Security Features

- **Authentication Required**: All operations require user authentication
- **Group Membership Verification**: Rules check if users are members of groups before allowing access
- **Owner Permissions**: Group owners have additional permissions for group management
- **Data Validation**: Rules ensure data integrity for group operations

### Testing the Rules

After deploying, test the rules by:
1. Creating a group as one user
2. Sharing the invitation code with another user
3. Verifying the second user can join and view the group
4. Confirming users outside the group cannot access group data
