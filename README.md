<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1bmwmd1nuOEbDOPT4SSsqdg5NDM88ee78

## Run Locally

**Prerequisites:**
- Node.js
- Vercel CLI

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Install the Vercel CLI globally:**
    ```bash
    npm install -g vercel
    ```
3.  **Create Environment File:** Create a new file named `.env.local` in the root of your project.
4.  **Add Environment Variables:** Add your API keys and Supabase credentials to the `.env.local` file. It should look like this:
    ```
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    SUPABASE_URL="YOUR_SUPABASE_URL"
    SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
    ```
5.  **Run the app:**
    ```bash
    npm run dev
    ```
This will start a local development server that serves both your frontend application and your API routes.