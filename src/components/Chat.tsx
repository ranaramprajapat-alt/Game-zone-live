import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface Message {
  username: string;
  message: string;
  isSystem?: boolean;
  isCorrect?: boolean;
}

interface ChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  username: string;
}

export default function Chat({ messages, onSendMessage, username }: ChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-3 bg-white border-bottom border-slate-200 font-semibold text-slate-700">
        Chat & Guesses
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={cn(
              "text-sm p-2 rounded-lg",
              msg.isSystem ? "bg-slate-200 text-slate-600 text-center italic" : 
              msg.isCorrect ? "bg-emerald-100 text-emerald-700 font-bold text-center border border-emerald-200" :
              msg.username === username ? "bg-indigo-50 text-indigo-700 ml-4 border border-indigo-100" : 
              "bg-white text-slate-700 mr-4 border border-slate-100 shadow-sm"
            )}
          >
            {!msg.isSystem && !msg.isCorrect && (
              <span className="font-bold mr-2">{msg.username}:</span>
            )}
            {msg.message}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your guess..."
          className="flex-1 px-3 py-2 bg-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
        />
        <button
          type="submit"
          className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
