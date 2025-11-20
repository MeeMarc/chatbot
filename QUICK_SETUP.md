# Quick Setup Checklist

## ✅ Neon DB Setup

- [ ] Create account at https://neon.tech
- [ ] Create new project
- [ ] Copy connection string
- [ ] Run `database_schema.sql` in SQL Editor
- [ ] Verify tables created (users, conversations, messages)

## ✅ Backend Setup

- [ ] Choose backend: Node.js/Express OR Python/Flask
- [ ] Install dependencies (`npm install` or `pip install -r requirements.txt`)
- [ ] Create `.env` file with DATABASE_URL
- [ ] Test database connection
- [ ] Deploy backend (Vercel/Railway/Render)

## ✅ Frontend Updates

- [ ] Create `api.js` with API functions
- [ ] Update `login.html` to use API
- [ ] Update `signup.html` to use API
- [ ] Update `script.js` to use API instead of localStorage
- [ ] Update API_URL in config
- [ ] Test all features

## ✅ Security

- [ ] Add JWT authentication (optional but recommended)
- [ ] Add input validation
- [ ] Add rate limiting
- [ ] Use HTTPS in production
- [ ] Never commit `.env` file

## ✅ Deployment

- [ ] Deploy backend
- [ ] Update frontend API_URL to production backend URL
- [ ] Deploy frontend
- [ ] Test everything works
- [ ] Monitor database usage in Neon dashboard

