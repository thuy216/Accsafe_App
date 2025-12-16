import React, { useRef, useEffect, useState } from "react";
import { Eraser, Send, MessageCircle, Trash2 } from "lucide-react";
import { Button, Modal } from "../components/UIComponents";
import { ChatMessage, ChatSession } from "../types";
import { chatAPI } from "../services/api";

interface AdminChatViewProps {
  t: any;
  chatSessions: ChatSession[];
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  selectedChatUser: string | null;
  setSelectedChatUser: (userId: string | null) => void;
  notify: (msg: string) => void;
}

export const AdminChatView: React.FC<AdminChatViewProps> = ({
  t,
  chatSessions,
  setChatSessions,
  selectedChatUser,
  setSelectedChatUser,
  notify,
}) => {
  const [adminMessageInput, setAdminMessageInput] = useState("");
  const [isClearModalOpen, setIsClearModalOpen] = useState(false); // State cho Modal xác nhận xóa
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const adminChatScrollRef = useRef<HTMLDivElement>(null);

  // Load chat sessions từ API khi component mount hoặc khi cần refresh
  const loadChatSessions = async () => {
    try {
      setIsLoading(true);
      const sessions = await chatAPI.getAllChatSessions();
      setChatSessions(sessions);
    } catch (error: any) {
      console.error("[AdminChatView] Error loading chat sessions:", error);
      notify(error.message || "Không thể tải chat sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChatRequest = () => {
    if (!selectedChatUser) return;
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteChat = async () => {
    if (!selectedChatUser) return;

    const currentSession = chatSessions.find(
      (s) => s.userId === selectedChatUser || s.userEmail === selectedChatUser
    );

    if (!currentSession) {
      setIsDeleteModalOpen(false);
      return;
    }

    // Optimistic remove
    const previousSessions = [...chatSessions];
    setChatSessions((prev) =>
      prev.filter(
        (s) =>
          s.userId !== selectedChatUser && s.userEmail !== selectedChatUser
      )
    );
    setSelectedChatUser(null);
    setIsDeleteModalOpen(false);

    try {
      await chatAPI.deleteChatSession(selectedChatUser);
      await loadChatSessions();
      notify(t.success);
    } catch (error: any) {
      console.error("[AdminChatView] Error deleting chat:", error);
      notify(error.message || "Không thể xóa chat");
      // Rollback
      setChatSessions(previousSessions);
    }
  };

  // Auto-refresh chat sessions mỗi 3 giây để có real-time updates
  useEffect(() => {
    // Load lần đầu
    loadChatSessions();

    // Setup polling để refresh mỗi 3 giây
    const intervalId = setInterval(() => {
      loadChatSessions();
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, []); // Chỉ chạy một lần khi component mount

  useEffect(() => {
    if (adminChatScrollRef.current) {
      adminChatScrollRef.current.scrollTop =
        adminChatScrollRef.current.scrollHeight;
    }
  }, [chatSessions, selectedChatUser]);

  const handleSendAdminMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!adminMessageInput.trim() || !selectedChatUser) return;

    const messageText = adminMessageInput.trim();
    setAdminMessageInput(""); // Clear input ngay để UX tốt hơn

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "admin",
      text: messageText,
      timestamp: Date.now(),
    };

    // Optimistic update - cập nhật UI ngay
    const currentSession = chatSessions.find(
      (s) => s.userId === selectedChatUser || s.userEmail === selectedChatUser
    );

    if (currentSession) {
      const updatedSession: ChatSession = {
        ...currentSession,
        messages: [...currentSession.messages, newMessage],
        lastUpdated: Date.now(),
      };

      // Update local state ngay
      setChatSessions((prev) =>
        prev.map((s) =>
          s.userId === selectedChatUser || s.userEmail === selectedChatUser
            ? updatedSession
            : s
        )
      );

      // Lưu lên server
      try {
        await chatAPI.saveChatSession(updatedSession);
        // Refresh để lấy dữ liệu mới nhất từ server
        await loadChatSessions();
      } catch (error: any) {
        console.error("[AdminChatView] Error saving message:", error);
        notify(error.message || "Không thể gửi tin nhắn");
        // Rollback nếu lỗi
        setChatSessions((prev) =>
          prev.map((s) =>
            s.userId === selectedChatUser || s.userEmail === selectedChatUser
              ? currentSession
              : s
          )
        );
        setAdminMessageInput(messageText); // Restore input
      }
    } else {
      // Tạo session mới nếu chưa có
      const newSession: ChatSession = {
        userId: selectedChatUser,
        userEmail: selectedChatUser,
        messages: [newMessage],
        lastUpdated: Date.now(),
      };

      setChatSessions((prev) => [...prev, newSession]);

      try {
        await chatAPI.saveChatSession(newSession);
        await loadChatSessions();
      } catch (error: any) {
        console.error("[AdminChatView] Error creating session:", error);
        notify(error.message || "Không thể tạo chat session");
        // Rollback
        setChatSessions((prev) =>
          prev.filter((s) => s.userId !== selectedChatUser && s.userEmail !== selectedChatUser)
        );
        setAdminMessageInput(messageText);
      }
    }
  };

  const handleClearChatRequest = () => {
    if (!selectedChatUser) return;
    setIsClearModalOpen(true);
  };

  const confirmClearChat = async () => {
    if (!selectedChatUser) return;

    const currentSession = chatSessions.find(
      (s) => s.userId === selectedChatUser || s.userEmail === selectedChatUser
    );

    if (!currentSession) {
      setIsClearModalOpen(false);
      return;
    }

    // Optimistic update
    const clearedSession: ChatSession = {
      ...currentSession,
      messages: [],
      lastUpdated: Date.now(),
    };

    setChatSessions((prev) =>
      prev.map((s) =>
        s.userId === selectedChatUser || s.userEmail === selectedChatUser
          ? clearedSession
          : s
      )
    );

    setIsClearModalOpen(false);

    // Lưu lên server
    try {
      await chatAPI.saveChatSession(clearedSession);
      await loadChatSessions();
      notify(t.success);
    } catch (error: any) {
      console.error("[AdminChatView] Error clearing chat:", error);
      notify(error.message || "Không thể xóa chat");
      // Rollback
      setChatSessions((prev) =>
        prev.map((s) =>
          s.userId === selectedChatUser || s.userEmail === selectedChatUser
            ? currentSession
            : s
        )
      );
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-160px)] flex flex-col md:flex-row gap-6">
      {/* Left: User List */}
      <div className="w-full md:w-80 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-bold text-lg">{t.chatHistory}</h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chatSessions.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              {t.noChats}
            </div>
          ) : (
            chatSessions
              .sort((a, b) => b.lastUpdated - a.lastUpdated)
              .map((session) => (
                <div
                  key={session.userId}
                  onClick={() => setSelectedChatUser(session.userId)}
                  className={`p-4 border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    selectedChatUser === session.userId
                      ? "bg-blue-50 dark:bg-blue-900/10"
                      : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm truncate w-2/3 block">
                      {session.userEmail}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatTime(session.lastUpdated)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {session.messages[session.messages.length - 1]?.text ||
                      "New conversation"}
                  </p>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Right: Chat Area */}
      <div className="flex-1 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
        {selectedChatUser ? (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30 rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-xs">
                  {selectedChatUser.substring(0, 2).toUpperCase()}
                </div>
                <span className="font-medium">{selectedChatUser}</span>
              </div>
              <Button
                variant="ghost"
                className="text-slate-500 hover:text-slate-700 p-2"
                onClick={handleClearChatRequest}
              >
                <Eraser className="w-4 h-4 mr-2" /> {t.clearChat}
              </Button>
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-700 p-2"
                onClick={handleDeleteChatRequest}
              >
                <Trash2 className="w-4 h-4 mr-2" /> {t.deleteChat}
              </Button>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900"
              ref={adminChatScrollRef}
            >
              {chatSessions
                .find((s) => s.userId === selectedChatUser)
                ?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === "admin" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        msg.sender === "admin"
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="mb-1">{msg.text}</div>
                      <div
                        className={`text-[10px] text-right ${
                          msg.sender === "admin"
                            ? "text-blue-100"
                            : "text-slate-400"
                        }`}
                      >
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <form
              onSubmit={handleSendAdminMessage}
              className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2"
            >
              <input
                type="text"
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t.typeMessage}
                value={adminMessageInput}
                onChange={(e) => setAdminMessageInput(e.target.value)}
              />
              <Button type="submit">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
            <p>Select a user to start chatting</p>
          </div>
        )}
      </div>

      {/* Custom Modal xác nhận xóa */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title={t.clearChat}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsClearModalOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={confirmClearChat}>
              {t.delete}
            </Button>
          </>
        }
      >
        <div className="p-6">
          <p className="text-slate-600 dark:text-slate-300">
            {t.clearChatConfirm}
          </p>
        </div>
      </Modal>

      {/* Modal xác nhận xóa hoàn toàn chat */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t.deleteChat}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={confirmDeleteChat}>
              {t.delete}
            </Button>
          </>
        }
      >
        <div className="p-6">
          <p className="text-slate-600 dark:text-slate-300">
            {t.deleteChatConfirm}
          </p>
        </div>
      </Modal>
    </div>
  );
};
