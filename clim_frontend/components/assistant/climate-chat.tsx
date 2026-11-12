"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, LoaderCircle, MessageCircle, Sprout } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
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

const suggestedQuestions = [
  "Why might rice suit my location?",
  "What changed between the sample seasons?",
  "What should I check before planting?",
  "How could rainfall affect my crop?",
];

export function ClimateChat() {
  const { location } = useAppData();
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant",
        body: () => ({ location }),
      }),
    [location],
  );
  const { messages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";

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
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-panel"
        aria-label="ClimateCrop AI conversation"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-forest text-marigold">
              <Sprout size={19} aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-heading text-[16px] font-bold text-ink">ClimateCrop AI assistant</h1>
              <p className="mt-0.5 text-[13px] text-ink-mute">
                Context: {location || "no location set"} · demo data
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-0 flex-col items-center justify-center px-5 py-5 text-center sm:px-10">
              <h2 className="flex items-center gap-3 font-display text-[26px] leading-tight text-ink">
                <MessageCircle size={26} className="shrink-0 text-forest-mid" aria-hidden="true" />
                What would you like to understand?
              </h2>
              <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.6] text-ink-soft">
                Ask a question about the demonstration data, or start with one
                of these prompts. The assistant will identify missing context
                instead of guessing.
              </p>
              <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2.5">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => submitQuestion(question)}
                    className="min-h-11 rounded-full border border-line bg-panel px-4 py-2 text-[14px] font-medium text-ink-soft transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-forest-mid/40 hover:bg-forest-tint hover:text-forest active:translate-y-0"
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
                      const text = message.parts
                        .filter((part) => part.type === "text")
                        .map((part) => part.text)
                        .join("");
                      const isUser = message.role === "user";
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
                              <MessageAvatar className="size-8 min-w-8 self-start bg-forest text-marigold">
                                <Sprout size={15} aria-hidden="true" />
                              </MessageAvatar>
                            )}
                            <MessageContent className="max-w-[88%] gap-1.5 sm:max-w-[78%]">
                              <MessageHeader
                                className={`px-1 text-[12.5px] ${isUser ? "justify-end" : ""}`}
                              >
                                {isUser ? "You" : "ClimateCrop AI"}
                              </MessageHeader>
                              <Bubble
                                align={isUser ? "end" : "start"}
                                variant={isUser ? "default" : "secondary"}
                                className="max-w-full"
                              >
                                <BubbleContent className="px-4 py-3 text-[14.5px] leading-[1.65] whitespace-pre-wrap">
                                  {text}
                                </BubbleContent>
                              </Bubble>
                              {!isUser && (
                                <MessageFooter className="px-1 pt-1 text-[12px]">
                                  Based on the available demo context · not
                                  field advice
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
                          <MessageAvatar className="size-8 min-w-8 self-start bg-forest text-marigold">
                            <Sprout size={15} aria-hidden="true" />
                          </MessageAvatar>
                          <MessageContent>
                            <MessageHeader className="px-1 text-[12.5px]">
                              ClimateCrop AI
                            </MessageHeader>
                            <Bubble variant="secondary">
                              <BubbleContent className="flex items-center gap-2 px-4 py-3 text-[14px]">
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

        {error && (
          <div
            className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-[12px] bg-clay-tint px-4 py-3 sm:mx-5"
            role="alert"
          >
            <p className="text-[14px] leading-[1.5] text-clay-ink">
              The assistant could not connect. Please try again; no answer was
              invented.
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
          className="border-t border-line bg-paper p-3 sm:p-4"
        >
          <label htmlFor="assistant-prompt" className="sr-only">
            Ask ClimateCrop AI a question
          </label>
          <div className="flex items-end gap-2 rounded-[12px] border border-input bg-panel p-2 transition-colors focus-within:border-forest-mid focus-within:ring-3 focus-within:ring-forest-mid/15">
            <Textarea
              id="assistant-prompt"
              rows={1}
              maxLength={2000}
              placeholder="Ask about crops, seasons, or your next step…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isBusy}
              className="max-h-32 min-h-11 resize-none border-0 bg-transparent px-2 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
            />
            {isBusy ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Stop generating"
                onClick={stop}
                className="size-11 shrink-0 rounded-[10px]"
              >
                <span className="size-3 rounded-[3px] bg-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                aria-label="Send question"
                disabled={!input.trim()}
                className="size-11 shrink-0 rounded-[10px]"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <Marker className="text-[12px]">
              <MarkerContent>
                Demonstration data only · no live weather or soil source
                connected
              </MarkerContent>
            </Marker>
            <span className="hidden text-[12px] text-ink-mute sm:inline">
              Enter to send · Shift + Enter for a new line
            </span>
          </div>
        </form>
      </section>
    </div>
  );
}
