# Heroku Deployment Guide

## Quick Deployment Scripts

### 🚀 Deploy Everything
```bash
./deploy-all.sh "Your commit message"
```
Interactive script that lets you choose what to deploy (backend, frontend, or both).

### 🔧 Deploy Backend Only
```bash
./deploy-backend.sh "Backend changes description"
```

### 🎨 Deploy Frontend Only
```bash
./deploy-frontend.sh "Frontend changes description"
```

## Manual Deployment Commands

### Backend Deployment
```bash
# Stage and commit backend changes
git add backend/
git commit -m "Backend: your changes"

# Deploy to Heroku
heroku git:remote -a esoteric-backend
git subtree push --prefix backend heroku main
```

### Frontend Deployment
```bash
# Fix package-lock.json if needed
cd frontend && npm install && cd ..

# Stage and commit frontend changes
git add frontend/
git commit -m "Frontend: your changes"

# Deploy to Heroku
heroku git:remote -a esoteric-frontend
git subtree push --prefix frontend heroku main
```

## Application URLs

- **Frontend**: https://esoteric-frontend-f6672220c878.herokuapp.com
- **Backend API**: https://esoteric-backend-2a06148f13b9.herokuapp.com/api
- **Health Check**: https://esoteric-backend-2a06148f13b9.herokuapp.com/api/health

## Admin Login

- **Email**: demo@esoteric.com
- **Password**: admin123

## Monitoring & Debugging

### View Logs
```bash
# Backend logs
heroku logs --tail -a esoteric-backend

# Frontend logs
heroku logs --tail -a esoteric-frontend
```

### Restart Applications
```bash
# Restart backend
heroku restart -a esoteric-backend

# Restart frontend
heroku restart -a esoteric-frontend
```

### Check Application Status
```bash
# Backend status
heroku ps -a esoteric-backend

# Frontend status
heroku ps -a esoteric-frontend
```

### Database Access
```bash
# Connect to PostgreSQL
heroku pg:psql -a esoteric-backend

# Run SQL commands
heroku pg:psql -a esoteric-backend -c "SELECT * FROM users;"
```

## Common Issues & Solutions

### Frontend Build Fails
- **Issue**: package-lock.json out of sync
- **Solution**: Run `cd frontend && npm install && cd ..` then redeploy

### Backend Database Errors
- **Issue**: Missing database tables/columns
- **Solution**: Run migrations manually via `heroku pg:psql`

### Authentication Issues
- **Issue**: CORS or token problems
- **Solution**: Check environment variables are set correctly

### Environment Variables
```bash
# Check backend config
heroku config -a esoteric-backend

# Check frontend config
heroku config -a esoteric-frontend

# Set new environment variable
heroku config:set VARIABLE_NAME=value -a app-name
```

## Development Workflow

1. **Make changes** locally
2. **Test** on localhost
3. **Run deployment script**: `./deploy-all.sh "Description of changes"`
4. **Verify** deployment works
5. **Monitor logs** if issues occur

## Emergency Rollback

If deployment breaks something:

```bash
# Rollback backend
heroku rollback -a esoteric-backend

# Rollback frontend
heroku rollback -a esoteric-frontend
```
