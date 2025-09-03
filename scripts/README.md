# Scripts Directory

This directory contains all project scripts organized for better maintainability.

## 📁 Available Scripts

### Deployment Scripts
- `deploy-backend.sh` - Deploy backend only to Heroku
- `deploy-frontend.sh` - Deploy frontend only to Heroku  
- `deploy-heroku.sh` - Legacy Heroku deployment script

### Development Scripts
- `start-website.sh` - Start both frontend and backend development servers (Unix/Mac)
- `start-website.bat` - Start both frontend and backend development servers (Windows)
- `start-backend.sh` - Start backend server only

### Testing & Setup
- `test-local-setup.sh` - Test local environment setup and configuration

## 🚀 Quick Usage

**Start Development:**
```bash
./scripts/start-website.sh
```

**Deploy to Production:**
```bash
./deploy-all.sh "Your commit message"
```
*(Note: Main deployment script remains in project root for easy access)*

**Test Local Setup:**
```bash
./scripts/test-local-setup.sh
```

## 📝 Notes

- Main deployment script (`deploy-all.sh`) remains in project root for convenience
- All other scripts are organized here for better project structure
- Scripts maintain the same functionality as before, just with updated paths