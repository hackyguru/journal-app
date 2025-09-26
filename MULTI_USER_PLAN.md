# 🏗️ Multi-User Architecture Implementation Plan

## 📊 **Architecture Overview**

### **Current State:**
- Single user system
- All memories stored in Pinecone `default` namespace
- No user authentication
- Memory IDs: `memory-{date}-{random}`

### **Target State:**
- Multi-user system with Apple Sign-In
- User-isolated memories via metadata filtering
- Memory IDs: `memory-{userId}-{date}-{random}`
- Secure user context throughout the app

---

## 🎯 **Implementation Strategy**

### **Phase 1: Authentication Setup**
1. **Install Expo Apple Authentication**
   ```bash
   npx expo install expo-apple-authentication
   ```

2. **Create Authentication Context**
   - `contexts/AuthContext.tsx` - User state management
   - `components/auth/AppleSignInButton.tsx` - Sign-in component
   - `hooks/useAuth.ts` - Authentication hook

3. **Update App Structure**
   - Add authentication wrapper in `app/_layout.tsx`
   - Create login screen for unauthenticated users
   - Persist user session with AsyncStorage

### **Phase 2: Backend User Context**
1. **Update API Endpoints**
   - Add `userId` parameter to all memory operations
   - Update Pinecone queries to filter by user
   - Modify memory IDs to include user context

2. **User Metadata Structure**
   ```javascript
   {
     id: "memory-{userId}-{date}-{random}",
     metadata: {
       userId: "apple_user_123456",
       text: "Memory content...",
       date: "2025-09-26",
       timestamp: "2025-09-26T10:30:00Z",
       source: "voice_recording",
       userEmail: "user@example.com", // Optional
       userName: "John Doe"           // Optional
     }
   }
   ```

3. **API Security**
   - Add user validation middleware
   - Ensure users can only access their own data
   - Add rate limiting per user

### **Phase 3: Frontend Integration**
1. **Update Pinecone Hook**
   - Modify `hooks/usePinecone.ts` to include user context
   - Add user ID to all API calls
   - Handle authentication errors

2. **Update Components**
   - `components/daily-memory.tsx` - User-specific memory loading
   - `components/memory-chat.tsx` - User-specific chat context
   - `components/weekly-calendar.tsx` - User-specific memory indicators

3. **Add User Profile**
   - User settings screen
   - Sign-out functionality
   - Profile management

---

## 🔧 **Technical Implementation Details**

### **1. Apple Sign-In Flow**
```typescript
// Authentication flow
1. User taps "Sign in with Apple"
2. Apple returns: { user, email, fullName, identityToken }
3. Store user info in AsyncStorage
4. Send identityToken to backend for verification
5. Backend validates token and creates/updates user
6. Return user session to frontend
```

### **2. Pinecone Query Updates**
```javascript
// Before (single user)
const query = await namespace.query({
  topK: 100,
  includeMetadata: true,
  filter: { date: "2025-09-26" }
});

// After (multi-user)
const query = await namespace.query({
  topK: 100,
  includeMetadata: true,
  filter: { 
    userId: "apple_user_123456",
    date: "2025-09-26" 
  }
});
```

### **3. Memory ID Strategy**
```javascript
// Current: memory-2025-09-26-abc123
// New:     memory-apple_user_123456-2025-09-26-abc123

const generateMemoryId = (userId, date) => {
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  return `memory-${userId}-${date}-${randomSuffix}`;
};
```

---

## 📱 **User Experience Flow**

### **First Time User:**
1. Opens app → See "Sign in with Apple" button
2. Taps button → Apple authentication flow
3. Grants permissions → User profile created
4. Redirected to main app → Can create memories

### **Returning User:**
1. Opens app → Auto-login from stored session
2. Immediately see their personal memories
3. All features work with their user context

### **Data Isolation:**
- Users only see their own memories
- Search only returns their memories  
- Voice recordings tied to their account
- Chat context is user-specific

---

## 🛡️ **Security Considerations**

1. **Token Validation**
   - Verify Apple ID tokens on backend
   - Implement token refresh mechanism
   - Handle expired sessions gracefully

2. **Data Protection**
   - All API calls require valid user context
   - Server-side validation of user ownership
   - No cross-user data leakage

3. **Privacy**
   - Store minimal user information
   - Allow account deletion
   - Comply with Apple's privacy requirements

---

## 🚀 **Migration Strategy**

### **For Existing Data:**
Since you currently have memories without user IDs, we have options:

1. **Option A: Fresh Start**
   - Keep existing data as "demo/test" data
   - All new users start with empty memory bank
   - Clean and simple

2. **Option B: Assign to Default User**
   - Create a "default" user for existing memories
   - Migrate existing memories to this user
   - You keep your current memories

**Recommendation:** Option A for cleaner architecture

---

## 📈 **Scalability Benefits**

1. **Cost Efficient**
   - Single Pinecone namespace = lower costs
   - Metadata filtering is fast and efficient

2. **Performance**
   - User-specific queries are faster
   - Smaller result sets per user

3. **Maintenance**
   - Single codebase handles all users
   - Easy to add new features for all users

4. **Analytics**
   - Track user engagement per user
   - Understand usage patterns
   - Plan feature improvements

---

## 🎯 **Next Steps**

1. **Confirm Architecture**: Approve this plan
2. **Start with Phase 1**: Implement Apple Sign-In
3. **Test Authentication**: Ensure smooth login flow
4. **Phase 2**: Update backend for user context
5. **Phase 3**: Update frontend components
6. **Testing**: Comprehensive multi-user testing
7. **Deployment**: Roll out to production

**Estimated Timeline:** 2-3 days for full implementation

Would you like me to start with Phase 1 (Apple Sign-In setup)?
