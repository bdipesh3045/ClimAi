"use client";

import { useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { APICallError, DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, LoaderCircle, MessageCircle, Sprout } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import type { FarmerProfile } from "@/lib/session";
import { ASSISTANT_ERRORS, isAssistantErrorMessage } from "@/lib/assistant-errors";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

// The server adds the farmer's saved profile to the prompt, so "my farm" needs no templating.
const suggestedQuestions = [
  "Which crops suit my farm best?",
  "When should I plant my current crops?",
  "How does my soil type affect what I can grow?",
  "How should I manage water on my farm?",
  "What weather risks should I watch for in my area?",
];

// Odd, so the slice starts on a user question. Must stay under the route's MAX_MESSAGES.
const MAX_SENT_MESSAGES = 11;

// Send only the latest messages so a long chat keeps working within the route's limits.
const transport = new DefaultChatTransport({
  api: "/api/assistant",
  prepareSendMessagesRequest: ({ messages }) => ({
    body: { messages: messages.slice(-MAX_SENT_MESSAGES) },
  }),
});

const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;

function chatErrorMessage(error: Error): string {
  if (isAssistantErrorMessage(error.message)) return error.message;
  if (APICallError.isInstance(error)) {
    if (error.statusCode === HTTP_UNAUTHORIZED) {
      return "Your sign-in has ended. Sign in again to use the assistant.";
    }
    if (error.statusCode === HTTP_TOO_MANY_REQUESTS) {
      return "You have sent a lot of questions. Please wait a few minutes and try again.";
    }
  }
  return ASSISTANT_ERRORS.connection;
}

const NO_ANSWER_MESSAGE = ASSISTANT_ERRORS.empty;

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function profileLabel(profile: FarmerProfile | null, isMissing: boolean): string {
  if (profile !== null) {
    return `Using your profile: ${profile.farmName ?? "your farm"} · ${profile.location}`;
  }
  return isMissing ? "No farm profile saved yet" : "Loading your profile…";
}

export function ClimateChat() {
  const { state } = useAuth();
  const profile = state.status === "signed-in" ? state.account.profile : null;
  // Only true once sign-in has resolved, so the "add profile" prompt does not flash while loading.
  const isProfileMissing = state.status === "signed-in" && profile === null;
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  // A failed or timed-out answer can end with no text and no error. Treat it as a failure too,
  // so the farmer sees "Try again" instead of a silent empty chat.
  const isUnanswered =
    status === "ready" &&
    lastMessage !== undefined &&
    (lastMessage.role === "user" || messageText(lastMessage).trim() === "");

  function submitQuestion(question = input) {
    const trimmed = question.trim();
    if (!trimmed || isBusy) return;
    clearError();
    sendMessage({ text: trimmed });
    setInput("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion();
  }

  function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    )
      return;
    event.preventDefault();
    submitQuestion();
  }

  return (
    <div className="h-full min-h-0 w-full">
      <section
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e7ebe5] bg-white"
        aria-label="ClimateAI conversation"
      >
        <header className="flex items-center justify-between border-b border-[#edf0eb] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#eaf2e8] text-[#286540]">
              <Sprout size={17} />
            </span>
            <div>
              <p className="text-xs font-semibold">ClimateAI assistant</p>
              <p className="mt-0.5 text-[10px] text-[#899289]">
                {profileLabel(profile, isProfileMissing)}
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-0 flex-col items-center justify-center px-5 py-5 text-center sm:px-10">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f1f6ed] text-[#398253]">
                <MessageCircle size={21} />
              </span>
              <h2 className="mt-4 font-heading text-xl font-bold tracking-[-0.03em]">
                What would you like to understand?
              </h2>
              <p className="mt-2 max-w-md text-xs leading-5 text-[#7b857b]">
                Ask about your farm, or start with one of these questions. The
                assistant uses your saved profile and says when something is
                missing instead of guessing.
              </p>
              {isProfileMissing && (
                <p className="mt-3 text-xs text-[#7b857b]">
                  <Link
                    href="/profile"
                    className="font-semibold text-[#286540] underline underline-offset-2"
                  >
                    Add your farm profile
                  </Link>{" "}
                  for answers about your own land.
                </p>
              )}
              <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => submitQuestion(question)}
                    className="rounded-full border border-[#e3e9e1] bg-[#fcfcf8] px-3.5 py-2 text-[11px] font-medium text-[#536257] transition-colors hover:border-[#b9d0b6] hover:bg-[#f1f6ed] focus-visible:ring-2 focus-visible:ring-[#398253] focus-visible:ring-offset-2"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <MessageScrollerProvider>
              <MessageScroller className="h-full min-h-0">
                <MessageScrollerViewport aria-label="Conversation messages">
                  <MessageScrollerContent className="gap-5 px-4 py-5 sm:px-6">
                    {messages.map((message, messageIndex) => {
                      const text = messageText(message);
                      const isUser = message.role === "user";
                      // An answer with no text yet (or a failed one) shows as the
                      // "Thinking" row or the error banner, not an empty bubble.
                      if (!isUser && text.trim() === "") return null;
                      return (
                        <MessageScrollerItem
                          key={message.id}
                          scrollAnchor={messageIndex === messages.length - 1}
                        >
                          <Message
                            align={isUser ? "end" : "start"}
                            className="gap-2.5"
                          >
                            {!isUser && (
                              <MessageAvatar className="size-8 min-w-8 self-start bg-[#eaf2e8] text-[#286540]">
                                <Sprout size={15} aria-hidden="true" />
                              </MessageAvatar>
                            )}
                            <MessageContent className="max-w-[88%] gap-1.5 sm:max-w-[78%]">
                              <MessageHeader
                                className={`px-1 text-[10px] ${isUser ? "justify-end" : ""}`}
                              >
                                {isUser ? "You" : "ClimateAI"}
                              </MessageHeader>
                              <Bubble
                                align={isUser ? "end" : "start"}
                                variant={isUser ? "default" : "secondary"}
                                className="max-w-full"
                              >
                                <BubbleContent className="whitespace-pre-line px-4 py-3 text-xs leading-6">
                                  {text}
                                </BubbleContent>
                              </Bubble>
                              {!isUser && (
                                <MessageFooter className="px-1 pt-1 text-[9px]">
                                  {profile === null
                                    ? "General guidance"
                                    : "Based on your farm profile"}{" "}
                                  · not field advice
                                </MessageFooter>
                              )}
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      );
                    })}
                    {isBusy && (
                      <MessageScrollerItem scrollAnchor>
                        <Message align="start">
                          <MessageAvatar className="size-8 min-w-8 self-start bg-[#eaf2e8] text-[#286540]">
                            <Sprout size={15} />
                          </MessageAvatar>
                          <MessageContent>
                            <MessageHeader className="px-1 text-[10px]">
                              ClimateAI
                            </MessageHeader>
                            <Bubble variant="secondary">
                              <BubbleContent className="flex items-center gap-2 px-4 py-3 text-xs">
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                />
                                Thinking through the available context…
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton variant="outline" size="icon-sm" />
              </MessageScroller>
            </MessageScrollerProvider>
          )}
        </div>

        {(error || isUnanswered) && (
          <div
            className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#edd8d3] bg-[#fbf4f2] px-4 py-3 sm:mx-5"
            role="alert"
          >
            <p className="text-xs leading-5 text-[#87594c]">
              {error ? chatErrorMessage(error) : NO_ANSWER_MESSAGE}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full bg-white"
              onClick={() => regenerate()}
            >
              Try again
            </Button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border-t border-[#edf0eb] bg-[#fcfcf8] p-3 sm:p-4"
        >
          <label htmlFor="assistant-prompt" className="sr-only">
            Ask ClimateAI a question
          </label>
          <div className="flex items-end gap-2 rounded-2xl border border-[#e2e8df] bg-white p-2 focus-within:border-[#a8c5a5] focus-within:ring-2 focus-within:ring-[#398253]/15">
            <Textarea
              id="assistant-prompt"
              rows={1}
              maxLength={2000}
              placeholder="Ask about crops, seasons, or your next step…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isBusy}
              className="max-h-32 min-h-10 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
            />
            {isBusy ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Stop generating"
                onClick={stop}
                className="shrink-0 rounded-xl"
              >
                <span className="size-2.5 rounded-sm bg-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                aria-label="Send question"
                disabled={!input.trim()}
                className="shrink-0 rounded-xl"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <Marker className="text-[9px]">
              <MarkerContent>
                Uses your saved farm profile · no live weather or soil feed
              </MarkerContent>
            </Marker>
            <span className="text-[9px] text-[#9aa39a]">
              Enter to send · Shift + Enter for a new line
            </span>
          </div>
        </form>
      </section>
    </div>
  );
}
