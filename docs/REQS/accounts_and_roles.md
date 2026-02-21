# Requirements: Accounts and Roles

## Scope

This document defines requirements for user accounts (optional), authentication, authorisation, and role-based access control for Council staff and residents.

## Requirements

### R1: Optional User Accounts (v1 Phase)

**Requirement**: Users can create optional accounts to track contributions, save routes, and manage preferences. Anonymous usage must remain available.

**Acceptance Criteria**:
- Given a user wants to create an account
- When they sign up (email/password or social login)
- Then account is created
- And they can see their contribution history
- And they can save favourite routes
- And their data is stored securely with privacy controls
- And anonymous usage remains available (no account required)

**Data Needed**:
- User account data (email, hashed password, account ID)
- User preferences (routing preferences, saved routes)
- User contribution history (linked to account)

**API/Interface Notes**:
- Authentication service (email/password, social login optional)
- Account management API
- Secure password storage (hashing, salting)
- Session management

**Testing Notes**:
- Test account creation
- Test authentication (login, logout)
- Test account features (contribution history, saved routes)
- Test anonymous usage still works
- Test security (password hashing, session management)

**Open Questions**:
- Should social login be supported? (Google, Facebook, etc.) - Simpler but adds dependencies
- What information to collect? (Email required, name optional?)
- Should accounts be required for submissions? (Probably not, keep anonymous option)

---

### R2: Contribution History

**Requirement**: Users with accounts can view their own submitted observations and see their contribution impact.

**Acceptance Criteria**:
- Given a user has an account and has submitted observations
- When they view their contribution history
- Then they see list of their observations
- And they can see observation details (location, type, date)
- And they can see observation status (approved, pending, rejected)
- And they can see their observations on the map (highlighted)

**Data Needed**:
- User account identifier
- User contributions (linked to account)
- Contribution metadata (status, impact)

**API/Interface Notes**:
- Contribution history API
- Contribution display component
- Map integration (highlight user contributions)

**Testing Notes**:
- Test contribution history display
- Test contribution filtering and sorting
- Test map highlighting
- Test with no contributions (empty state)
- Test privacy (users only see their own contributions)

**Open Questions**:
- Should users see impact of contributions? (How many people viewed route with their data)
- Should users be able to edit or delete contributions? (Allow corrections, but may affect data quality)

---

### R3: Saved Routes

**Requirement**: Users with accounts can save favourite routes for quick access.

**Acceptance Criteria**:
- Given a user has an account and has planned a route
- When they save the route
- Then route is saved with name and metadata
- And they can view saved routes later
- And they can delete saved routes
- And saved routes are private (only visible to user)

**Data Needed**:
- User account identifier
- Saved route data (origin, destination, route geometry, name, metadata)

**API/Interface Notes**:
- Saved routes API
- Route storage
- Route retrieval and display

**Testing Notes**:
- Test route saving
- Test route retrieval
- Test route deletion
- Test route naming
- Test privacy (users only see their own routes)

**Open Questions**:
- How many routes can users save? (Limit or unlimited)
- Should routes be shareable? (Probably not for MVP/v1, but future consideration)

---

### R4: Council Staff Access

**Requirement**: Council staff must have access to insights dashboard with appropriate authentication and authorisation.

**Acceptance Criteria**:
- Given a Council staff member needs access to insights
- When they authenticate (email/password or Council SSO if available)
- Then they can access insights dashboard
- And they can view aggregated data and exports
- And access is logged for audit purposes

**Data Needed**:
- Council staff account data
- Role assignments (Council staff role)
- Access logs

**API/Interface Notes**:
- Authentication service
- Authorisation service (role-based access)
- Access logging

**Testing Notes**:
- Test Council staff authentication
- Test insights dashboard access
- Test access restrictions (Council staff only)
- Test access logging

**Open Questions**:
- Should Council use separate accounts or same system? (Separate probably better for security)
- Should Council use SSO? (If Council has SSO system, integration may be complex)
- What roles are needed? (Council staff, admin, or more granular?)

---

### R5: Role-Based Access Control

**Requirement**: System must support different roles with different permissions (resident, Council staff, admin).

**Acceptance Criteria**:
- Given users have different roles
- When they access the system
- Then they see features appropriate to their role
- And they can only access data they have permission to view
- And unauthorised access attempts are blocked and logged

**Data Needed**:
- User roles (resident, Council staff, admin)
- Role permissions (what each role can do)
- Access control rules

**API/Interface Notes**:
- Role-based access control (RBAC) system
- Permission checking
- Access logging

**Testing Notes**:
- Test role-based access
- Test permission enforcement
- Test unauthorised access blocking
- Test access logging

**Open Questions**:
- What roles are needed? (Resident, Council staff, admin - or more granular?)
- What permissions does each role have? (Define clearly)
- Should roles be assignable by admins? (Probably yes for Council staff)

---

### R6: Privacy Controls

**Requirement**: Users must have control over their data: view, edit, delete, and export their data.

**Acceptance Criteria**:
- Given a user has an account
- When they access privacy controls
- Then they can view their data (contributions, saved routes, preferences)
- And they can edit their data (update preferences, edit contribution details if allowed)
- And they can delete their data (delete account, delete contributions, delete saved routes)
- And they can export their data (download data in standard format)

**Data Needed**:
- User data (contributions, saved routes, preferences)
- Privacy control settings
- Data export functionality

**API/Interface Notes**:
- Privacy controls API
- Data export API
- Data deletion API

**Testing Notes**:
- Test privacy controls access
- Test data viewing
- Test data editing
- Test data deletion
- Test data export
- Test privacy compliance (Australian Privacy Principles)

**Open Questions**:
- Should users be able to delete contributions? (May affect data quality, but privacy right)
- What format for data export? (JSON, CSV, PDF)
- How long to retain data after account deletion? (Privacy vs data quality)

---

### R7: Session Management

**Requirement**: User sessions must be managed securely with appropriate timeout and security measures.

**Acceptance Criteria**:
- Given a user logs in
- When they use the system
- Then session is maintained securely
- And session times out after inactivity (e.g., 30 minutes)
- And user can log out
- And session is invalidated on logout

**Data Needed**:
- Session data (session ID, user ID, expiry)
- Session security tokens

**API/Interface Notes**:
- Session management service
- Secure session storage
- Session timeout handling

**Testing Notes**:
- Test session creation
- Test session maintenance
- Test session timeout
- Test logout
- Test session security

**Open Questions**:
- What session timeout? (30 minutes, 1 hour, configurable?)
- Should sessions persist across browser restarts? (Remember me option)
- What security measures? (HTTPS, secure cookies, CSRF protection)

---

## Data Needed

### User Accounts
- Account data (email, hashed password, account ID, creation date)
- User preferences (routing preferences, display preferences)
- User roles (resident, Council staff, admin)

### User Data
- Contribution history (linked to account)
- Saved routes (linked to account)
- Session data (session ID, user ID, expiry)

### Access Control
- Role definitions
- Permission definitions
- Access logs

## API or Interface Notes

### Authentication Service
- User registration
- User login (email/password, social login optional)
- User logout
- Password reset
- Secure password storage (hashing, salting)

### Authorisation Service
- Role-based access control
- Permission checking
- Access logging

### Account Management API
- Account creation
- Account update
- Account deletion
- Privacy controls
- Data export

### Session Management
- Session creation
- Session validation
- Session timeout
- Session invalidation

## Testing Notes

### Functional Testing
- Test account creation
- Test authentication (login, logout, password reset)
- Test account features (contribution history, saved routes)
- Test Council staff access
- Test role-based access control
- Test privacy controls
- Test session management

### Security Testing
- Test password security (hashing, salting)
- Test session security (secure cookies, CSRF protection)
- Test access control (unauthorised access blocked)
- Test data privacy (users only see their own data)
- Test authentication security (brute force protection, rate limiting)

### Performance Testing
- Test authentication performance
- Test session management performance
- Test account features performance

### Edge Case Testing
- Invalid login credentials
- Expired sessions
- Concurrent sessions
- Account deletion
- Data export with large datasets

## Open Questions

1. **Account requirement**: Should accounts be optional or required? (Optional preferred for MVP/v1)
2. **Social login**: Should social login be supported? (Simpler but adds dependencies)
3. **Council SSO**: Should Council use SSO? (If available, but integration may be complex)
4. **Roles**: What roles are needed? (Resident, Council staff, admin - or more granular?)
5. **Session timeout**: What timeout? (30 minutes, 1 hour, configurable?)
6. **Data deletion**: Should users be able to delete contributions? (Privacy vs data quality)
7. **Data export**: What format? (JSON, CSV, PDF)

## Related Documents

- [`REQS/privacy_safety_and_ethics.md`](privacy_safety_and_ethics.md): Privacy requirements
- [`FLOWS/06_council_insights_view.md`](../FLOWS/06_council_insights_view.md): Council insights flow
- [`DECISIONS.md`](../DECISIONS.md): Architecture decisions (ADR-004)
