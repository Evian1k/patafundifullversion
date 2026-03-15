/**
 * JobChat - In-app chat for job coordination
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJobChat } from '@/hooks/useRealtime';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface JobChatProps {
  jobId: string;
  currentUserId: string;
  currentUserName: string;
  otherUserName: string;
  initialMessages?: Message[];
  isVisible: boolean;
}

export function JobChat({
  jobId,
  currentUserId,
  currentUserName,
  otherUserName,
  initialMessages = [],
  isVisible,
}: JobChatProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages: realtimeMessages, sendMessage } = useJobChat(jobId);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  // Add realtime messages to the list
  useEffect(() => {
    if (realtimeMessages.length > 0) {
      setAllMessages((prev) => [...prev, ...realtimeMessages]);
    }
  }, [realtimeMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      sender_id: currentUserId,
      content: input,
      created_at: new Date().toISOString(),
    };

    setAllMessages((prev) => [...prev, tempMessage]);
    setInput('');
    setIsSending(true);

    try {
      sendMessage(input);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      setAllMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(input); // Restore input
    } finally {
      setIsSending(false);
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed bottom-4 right-4 w-96 h-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-40"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-t-lg">
        <h3 className="font-semibold">Chat with {otherUserName}</h3>
        <p className="text-xs opacity-75">Job #{jobId.substring(0, 8)}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          allMessages.map((message) => {
            const isOwn = message.sender_id === currentUserId;
            const time = new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg ${
                    isOwn
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm break-words">{message.content}</p>
                  <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                    {isOwn ? 'You' : otherUserName} • {time}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSending}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </motion.div>
  );
}
