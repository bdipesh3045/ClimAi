# Plan: Profile-aware AI Assistant on Gemini

Status: awaiting approval (Gate 1). Size tier: **standard**. It calls an external API,
sends user data to it, and adds a secret, so it gets full TDD and a security review.
It has a UI, so it ends with a browser walk.

## Goal

A signed-in farmer opens `/assistant` and sees a short list of ready questions. The
answers use the farmer's saved profile (location, farm size, soil, irrigation, current
crops). Answers come from Gemini through the farmer's own Gemini API key.

## What already exists

- `app/api/assistant/route.ts`: validated, streaming chat route (AI SDK `streamText`).
  It calls `"google/gemini-3.8-flash"`. That string goes through the Vercel AI Gateway,
  not the Gemini API, and `.env.local` has no key for either.
- `components/assistant/climate-chat.tsx`: chat UI with `useChat` and 4 suggested
  questions shown on the empty state. The questions and prompt are about demo data.
- Flask `GET /api/auth/me` returns `{user, profile}` for the session cookie.
  `lib/session.ts` `parseAccount` already validates that shape.
- `AppShell` already sends guests on app routes to `/login?next=...`.

So this is a change to an existing feature, not a new one.

## Decisions

1. **Provider: `@ai-sdk/google`, model `gemini-3.8-flash`.** One new package. It reads
   `GOOGLE_GENERATIVE_AI_API_KEY` (server only, never `NEXT_PUBLIC_`). Get a key from
   Google AI Studio. `gemini-3.8-flash` is the current GA Flash model.
   Not chosen: the Vercel AI Gateway. The code uses it today, but it needs a Vercel
   account and gateway key, and you asked for the Gemini API.
2. **The server fetches the profile, the browser does not send it.** The route handler
   forwards the request's `cookie` header to `${BACKEND_URL}/api/auth/me` and parses the
   result with `parseAccount`. Effects:
   - The profile in the prompt is the saved one. A client cannot change it.
   - Guests get `401`, so nobody can spend the Gemini key without an account.
   - No Flask change.
3. **Only the farm facts go to Gemini:** farm name, location label, coordinates (2
   decimals), farm size and unit, soil type, irrigation, current crops. Phone, email
   and full name stay out. Gemini does not need them to answer.
4. **The profile is untrusted text in the prompt.** It goes in a delimited
   `<farm_profile>` block. Control characters are stripped. Each field keeps the Flask
   length caps. The instructions say the block is data, not instructions.
5. **Remove the demo dashboard numbers from the prompt.** They are fabricated, and with
   a real profile they confuse the answers. The prompt keeps the honesty rules: no live
   weather or soil feed, say what is missing, separate general knowledge from profile
   facts, refer to local extension for big decisions.
6. **Predefined questions are a static list.** "My farm" resolves on the server because
   the profile is in the prompt, so the list needs no templating:
   - Which crops suit my farm best?
   - When should I plant my current crops?
   - How does my soil type affect what I can grow?
   - How should I manage water on my farm?
   - What weather risks should I watch for in my area?
7. **Rate limit: 20 messages per user per 10 minutes**, in memory, keyed by user id.
   `ponytail:` comment: per process only, move to a shared store for more than one
   server. Over the limit returns `429`.

## Changes

| File | Change |
|------|--------|
| `package.json` | add `@ai-sdk/google` (major that matches `ai@7`, confirm with docs-lookup) |
| `.env.example` | document `GOOGLE_GENERATIVE_AI_API_KEY` |
| `lib/assistant-context.ts` | new, plain TS: `buildFarmContext(profile \| null)` returns the `<farm_profile>` text, or a "no profile saved" line |
| `lib/assistant-context.test.mjs` | new, `node --test` |
| `app/api/assistant/route.ts` | fetch `/me` with the cookie (401 guest, 503 backend down), rate limit, `google("gemini-3.8-flash")`, new instructions, drop the `location` body field and demo imports. Missing API key: log it on the server, return 503 |
| `components/assistant/climate-chat.tsx` | new question list; header shows "Using your profile: <farm> · <location>" from `useAuth`; no profile shows a "Add your farm profile" link to `/profile`; remove `location` from the transport body; replace "demo data" copy; show "Sign in" for a 401 and "Slow down" for a 429 |

The existing message validation in the route (count, length, text only) stays as it is.

## Slices, in order

1. **Gemini direct.** Add the package, the env var, swap the model. Demo: the current
   chat answers with your key.
2. **Profile in the prompt.** `assistant-context.ts` and its test (RED, then GREEN), the
   `/me` fetch, the 401, the new instructions. Demo: ask "What soil do I have?" and get
   the soil from your profile. Without a cookie, curl gets 401.
3. **Chat UI.** Questions, profile header, no-profile link, error copy. Demo: click each
   question and get an answer about your farm.
4. **Rate limit.** Demo: the 21st message in 10 minutes gets 429.

MUST-DEMO: 1 to 4. Slice 4 is small, and the project security rules require a rate
limit on every endpoint.

NICE:
- Put the latest Crop Finder result (the ranked crops from `crops.json`) in the prompt,
  so "Which crops suit my farm?" uses real scores, not general knowledge.
- Show follow-up question chips after each answer.

CUT: saved chat history, tool calls for live weather, retrieval over documents, voice,
more languages.

## Tests

- `assistant-context.test.mjs`:
  - a full profile gives every farm field;
  - phone, email and full name never appear;
  - a newline or `</farm_profile>` in a field cannot break out of the block;
  - a `null` profile gives the "no profile saved" line;
  - no irrigation, null soil and an empty crop list read as "not given".
- Route smoke with curl: no cookie gives 401, a signed-in cookie gives a stream, a bad
  body gives 400.
- Browser walk: sign in, open the assistant, click 2 questions, check that the answers
  name the profile's soil and location, zero console errors.

## Review

`security-reviewer` on slices 2 and 4 (external API, user data, secret, cookie
forwarding). `typescript-reviewer` on all slices, `react-reviewer` on slice 3. Fix all
CRITICAL and HIGH findings before Gate 2.

## Open questions (defaults apply if you do not answer)

1. Direct Gemini key with `@ai-sdk/google`, not the AI Gateway. Default: yes.
2. Guests cannot use the assistant. Default: yes.
3. Keep phone, email and full name out of the prompt. Default: yes.
4. Remove the demo numbers from the prompt. Default: yes.

## Note

The auth and profile work (`accounts.py`, login, signup, profile pages) is not
committed yet. Commit it before this work starts, so the two changes stay separate.
