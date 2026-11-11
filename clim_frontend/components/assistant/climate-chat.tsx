"use client"

import { useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowUp, LoaderCircle, MessageCircle, Sprout, Sparkles } from "lucide-react"
import { PageIntro } from "@/components/shared/page-intro"
import { useAppData } from "@/components/providers/app-data-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from "@/components/ui/message"
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from "@/components/ui/message-scroller"

const suggestedQuestions = [
  "Why might rice suit my location?",
  "What changed between the sample seasons?",
  "What should I check before planting?",
  "How could rainfall affect my crop?",
]

export function ClimateChat() {
  const { location } = useAppData()
  const [input, setInput] = useState("")
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/assistant",
    body: () => ({ location }),
  }), [location])
  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat({ transport })
  const isBusy = status === "submitted" || status === "streaming"

  function submitQuestion(question = input) {
    const trimmed = question.trim()
    if (!trimmed || isBusy) return
    clearError()
    sendMessage({ text: trimmed })
    setInput("")
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitQuestion()
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    submitQuestion()
  }

  return (
    <div>
      <PageIntro eyebrow="A thoughtful place to start" title="Ask ClimateAI." description="Explore crops, climate context, and practical next steps. Answers use only the information available in this demo and will call out what is missing." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
        <section className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-[#e7ebe5] bg-white" aria-label="ClimateAI conversation">
          <header className="flex items-center justify-between border-b border-[#edf0eb] px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-[#eaf2e8] text-[#286540]"><Sprout size={17} /></span><div><p className="text-xs font-semibold">ClimateAI assistant</p><p className="mt-0.5 text-[10px] text-[#899289]">Context: {location} · demo data</p></div></div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f6ed] px-2.5 py-1 text-[9px] font-medium text-[#63816a]"><span className="size-1.5 rounded-full bg-[#8eb895]" />Ready to explore</span>
          </header>

          <div className="min-h-0 flex-1">
            {messages.length === 0 ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center px-5 py-8 text-center sm:px-10">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f1f6ed] text-[#398253]"><MessageCircle size={21} /></span>
                <h2 className="mt-4 font-heading text-xl font-bold tracking-[-0.03em]">What would you like to understand?</h2>
                <p className="mt-2 max-w-md text-xs leading-5 text-[#7b857b]">Ask a question about the demonstration data, or start with one of these prompts. The assistant will identify missing context instead of guessing.</p>
                <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedQuestions.map((question) => <button key={question} type="button" onClick={() => submitQuestion(question)} className="rounded-full border border-[#e3e9e1] bg-[#fcfcf8] px-3.5 py-2 text-[11px] font-medium text-[#536257] transition-colors hover:border-[#b9d0b6] hover:bg-[#f1f6ed] focus-visible:ring-2 focus-visible:ring-[#398253] focus-visible:ring-offset-2">{question}</button>)}
                </div>
              </div>
            ) : (
              <MessageScrollerProvider>
                <MessageScroller className="h-[430px] sm:h-[480px]">
                  <MessageScrollerViewport aria-label="Conversation messages">
                    <MessageScrollerContent className="gap-5 px-4 py-5 sm:px-6">
                      {messages.map((message, messageIndex) => {
                        const text = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")
                        const isUser = message.role === "user"
                        return (
                          <MessageScrollerItem key={message.id} scrollAnchor={messageIndex === messages.length - 1}>
                            <Message align={isUser ? "end" : "start"} className="gap-2.5">
                              {!isUser && <MessageAvatar className="size-8 min-w-8 self-start bg-[#eaf2e8] text-[#286540]"><Sprout size={15} aria-hidden="true" /></MessageAvatar>}
                              <MessageContent className="max-w-[88%] gap-1.5 sm:max-w-[78%]">
                                <MessageHeader className={`px-1 text-[10px] ${isUser ? "justify-end" : ""}`}>{isUser ? "You" : "ClimateAI"}</MessageHeader>
                                <Bubble align={isUser ? "end" : "start"} variant={isUser ? "default" : "secondary"} className="max-w-full">
                                  <BubbleContent className="px-4 py-3 text-xs leading-6">{text}</BubbleContent>
                                </Bubble>
                                {!isUser && <MessageFooter className="px-1 pt-1 text-[9px]">Based on the available demo context · not field advice</MessageFooter>}
                              </MessageContent>
                            </Message>
                          </MessageScrollerItem>
                        )
                      })}
                      {isBusy && <MessageScrollerItem scrollAnchor><Message align="start"><MessageAvatar className="size-8 min-w-8 self-start bg-[#eaf2e8] text-[#286540]"><Sprout size={15} /></MessageAvatar><MessageContent><MessageHeader className="px-1 text-[10px]">ClimateAI</MessageHeader><Bubble variant="secondary"><BubbleContent className="flex items-center gap-2 px-4 py-3 text-xs"><LoaderCircle size={14} className="animate-spin" />Thinking through the available context…</BubbleContent></Bubble></MessageContent></Message></MessageScrollerItem>}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton variant="outline" size="icon-sm" />
                </MessageScroller>
              </MessageScrollerProvider>
            )}
          </div>

          {error && <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#edd8d3] bg-[#fbf4f2] px-4 py-3 sm:mx-5" role="alert"><p className="text-xs leading-5 text-[#87594c]">The assistant could not connect. Please try again; no answer was invented.</p><Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full bg-white" onClick={() => regenerate()}>Try again</Button></div>}

          <form onSubmit={handleSubmit} className="border-t border-[#edf0eb] bg-[#fcfcf8] p-3 sm:p-4">
            <label htmlFor="assistant-prompt" className="sr-only">Ask ClimateAI a question</label>
            <div className="flex items-end gap-2 rounded-2xl border border-[#e2e8df] bg-white p-2 focus-within:border-[#a8c5a5] focus-within:ring-2 focus-within:ring-[#398253]/15">
              <Textarea id="assistant-prompt" rows={1} maxLength={2000} placeholder="Ask about crops, seasons, or your next step…" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKeyDown} disabled={isBusy} className="max-h-32 min-h-10 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0" />
              {isBusy ? <Button type="button" variant="secondary" size="icon" aria-label="Stop generating" onClick={stop} className="shrink-0 rounded-xl"><span className="size-2.5 rounded-sm bg-current" /></Button> : <Button type="submit" size="icon" aria-label="Send question" disabled={!input.trim()} className="shrink-0 rounded-xl"><ArrowUp /></Button>}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1"><Marker className="text-[9px]"><MarkerContent>Demonstration data only · no live weather or soil source connected</MarkerContent></Marker><span className="text-[9px] text-[#9aa39a]">Enter to send · Shift + Enter for a new line</span></div>
          </form>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#e7ebe5] bg-white p-5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#f1f6ed] text-[#398253]"><Sparkles size={17} /></span>
            <h2 className="mt-4 font-heading text-base font-bold">A useful second opinion</h2>
            <p className="mt-2 text-xs leading-5 text-[#777f77]">ClimateAI can explain the demo’s crop comparisons and seasonal patterns. It cannot inspect your field or replace local agronomic advice.</p>
          </section>
          <section className="rounded-2xl bg-[#eef4eb] p-5">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[#64816a] uppercase">Helpful prompts</p>
            <ul className="mt-3 flex flex-col gap-3 text-xs leading-5 text-[#536257]">
              <li>Share the crop and field conditions you&apos;re considering.</li>
              <li>Ask what information would make a recommendation more useful.</li>
              <li>Ask for a plain-language explanation of a demo chart.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
