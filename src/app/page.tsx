import { AssistantChatPopup } from "@/components/assistant-chat-popup";
import { AssistantExperienceProvider } from "@/components/assistant-experience";
import { LandingPage } from "@/components/landing-page";

export default function Home() {
  return (
    <AssistantExperienceProvider>
      <LandingPage />
      <AssistantChatPopup />
    </AssistantExperienceProvider>
  );
}
