# How to Upload to GitHub

This guide will help you upload Network Debugger Plus to GitHub, which you can use to:
- Host your privacy policy on GitHub Pages (free!)
- Version control your code
- Share your project
- Link it in the Chrome Web Store listing

## Option 1: Using GitHub Website (Easiest for Beginners)

### Step 1: Create GitHub Account
1. Go to https://github.com
2. Click **Sign up**
3. Create a free account

### Step 2: Create a New Repository
1. After logging in, click the **+** icon in the top-right corner
2. Select **New repository**
3. Fill in:
   - **Repository name**: `network-debugger-plus` (or any name you prefer)
   - **Description**: "Advanced network request inspector Chrome extension"
   - **Visibility**: 
     - ✅ **Public** (recommended - free, can host privacy policy)
     - ⚪ Private (only you can see it)
   - **DO NOT** check "Add a README file" (you already have one)
   - **DO NOT** add .gitignore or license yet
4. Click **Create repository**

### Step 3: Upload Files via GitHub Website
1. After creating the repository, you'll see a page with upload instructions
2. Click **uploading an existing file** link (or drag and drop)
3. Click **choose your files** or drag and drop your entire folder
4. Select all files EXCEPT:
   - `node_modules` (if exists)
   - `.git` folder (if exists)
   - Any temporary files
5. At the bottom, fill in:
   - **Commit message**: "Initial commit - Network Debugger Plus extension"
6. Click **Commit changes**

## Option 2: Using Git Command Line (Recommended for Developers)

### Step 1: Install Git
1. Download Git: https://git-scm.com/download/win
2. Install with default settings
3. Open PowerShell or Command Prompt

### Step 2: Initialize Git Repository
```powershell
# Navigate to your extension folder
cd C:\Users\socce\OneDrive\Desktop\network-inspector-extension

# Initialize git repository
git init

# Create .gitignore file (optional but recommended)
```

### Step 3: Create .gitignore File
Create a file named `.gitignore` with this content:
```
# OS files
.DS_Store
Thumbs.db
desktop.ini

# Editor files
.vscode/
.idea/
*.swp
*.swo
*~

# Temporary files
*.log
temp-package/
*.zip
```

### Step 4: Add Files and Commit
```powershell
# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - Network Debugger Plus extension"

# Add your GitHub username and email (first time only)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Step 5: Connect to GitHub
1. Create a new repository on GitHub (follow Step 2 from Option 1)
2. **DO NOT** initialize with README, .gitignore, or license
3. Copy the repository URL (e.g., `https://github.com/yourusername/network-debugger-plus.git`)

### Step 6: Push to GitHub
```powershell
# Add GitHub repository as remote
git remote add origin https://github.com/yourusername/network-debugger-plus.git

# Rename default branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

You'll be prompted for your GitHub username and password (or personal access token).

## Option 3: Using GitHub Desktop (Easiest GUI)

### Step 1: Download GitHub Desktop
1. Go to: https://desktop.github.com/
2. Download and install GitHub Desktop

### Step 2: Sign In
1. Open GitHub Desktop
2. Sign in with your GitHub account

### Step 3: Create Repository
1. Click **File** → **New Repository**
2. Fill in:
   - **Name**: `network-debugger-plus`
   - **Local Path**: Choose your extension folder
   - **Description**: "Advanced network request inspector Chrome extension"
   - **Git Ignore**: Select "None" (you already have files)
3. Click **Create Repository**

### Step 4: Publish to GitHub
1. Click **Publish repository** button
2. Check **Keep this code private** if you want it private (uncheck for public)
3. Click **Publish Repository**

## Hosting Privacy Policy on GitHub Pages

Once your repository is on GitHub:

### Step 1: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section (left sidebar)
4. Under **Source**, select:
   - **Branch**: `main` (or `master`)
   - **Folder**: `/ (root)`
5. Click **Save**

### Step 2: Access Your Privacy Policy
Your privacy policy will be available at:
```
https://yourusername.github.io/network-debugger-plus/privacy-policy.html
```

**Example:**
- If your username is `maxshtefan`
- And repository is `network-debugger-plus`
- URL would be: `https://maxshtefan.github.io/network-debugger-plus/privacy-policy.html`

### Step 3: Test the URL
1. Wait 1-2 minutes for GitHub to process
2. Visit the URL in your browser
3. Verify the privacy policy loads correctly

## Using Privacy Policy URL in Chrome Web Store

When filling out the Chrome Web Store listing:
1. Copy your GitHub Pages URL
2. Paste it in the **Privacy Policy URL** field
3. Example: `https://yourusername.github.io/network-debugger-plus/privacy-policy.html`

## Troubleshooting

### "Repository not found" error
- Make sure you're using the correct repository URL
- Verify you're logged into the correct GitHub account

### "Permission denied" error
- You may need to use a Personal Access Token instead of password
- Go to: https://github.com/settings/tokens
- Generate new token with `repo` scope
- Use token as password when pushing

### Files not showing up
- Make sure you've committed the files: `git add .` then `git commit`
- Make sure you've pushed: `git push`

### GitHub Pages not working
- Wait a few minutes after enabling Pages
- Check that your `privacy-policy.html` file is in the root of the repository
- Make sure the repository is public (or you have GitHub Pro for private repos)

## Next Steps After Uploading

1. ✅ **Test Privacy Policy URL**: Visit your GitHub Pages URL to verify it works
2. ✅ **Update README**: Consider adding installation instructions to your README.md
3. ✅ **Add License**: Consider adding a LICENSE file (MIT, Apache, etc.)
4. ✅ **Link in Store Listing**: Use the GitHub Pages URL as your privacy policy URL

## Quick Reference Commands

If you're using command line and need to update files later:

```powershell
# Check status
git status

# Add changed files
git add .

# Commit changes
git commit -m "Description of changes"

# Push to GitHub
git push
```

Your extension is now on GitHub! 🎉

