# Plan: Wire the chat to a real AI model

## Goal
Replace the mock `generateSmartAnswer()` replies in `src/aichat/App.tsx` with live responses from Lovable AI Gateway, while keeping the existing Claude-style UI intact.

## Steps
1. **Enable Lovable Cloud**
   - Activate Cloud for this project so the AI Gateway and secrets management become available.
   - Explain to the user that Cloud powers the AI backend with no external accounts needed.

2. **Add server function for chat completions**
   - Create `src/lib/ai.functions.ts` with a `sendMessage` server function.
   - Use `createServerFn` from `@tanstack/react-start`.
   - Call the Lovable AI Gateway chat-completions endpoint from inside the handler.
   - Read the gateway URL/API key from server-side env vars inside the handler.
   - Validate input with Zod: a list of `{ role, content }` messages plus an optional `model` string.
   - Return the assistant’s text content.

3. **Update the chat component**
   - In `src/aichat/App.tsx`, replace the synchronous `generateSmartAnswer()` path with an async flow.
   - Add a loading state while waiting for the server function.
   - Stream or append the assistant message after the server function returns.
   - Keep the existing thumbs, copy, regenerate, and suggestion UX unchanged.

4. **Handle errors gracefully**
   - If the gateway call fails, show a friendly inline error message in the assistant bubble and allow retry.

5. **Verify**
   - Check the build output for errors.
   - Test a message in the preview to confirm a real AI response appears.
