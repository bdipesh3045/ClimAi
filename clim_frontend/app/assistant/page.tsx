import { ClimateChat } from '@/components/assistant/climate-chat'
import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return (
    <>
      <h1 className="sr-only">AI Assistant</h1>
      <ClimateChat />
    </>
  )
}
