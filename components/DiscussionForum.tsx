"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Heart,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import {
  createForumPost,
  deleteForumPost,
  deleteForumReply,
  getForumPostsByModule,
  replyForumPost,
  toggleLikePost,
  toggleLikeReply,
} from "@/lib/actions/forum";

export type ForumPost = {
  id: string;
  moduleId?: string;
  courseSlug?: string;
  authorId?: string;
  author: string;
  role: "TEACHER" | "STUDENT";
  className?: string;
  title: string;
  content: string;
  createdAt: string;
  likes: number;
  liked?: boolean;
  replies: Array<{
    id: string;
    authorId?: string;
    author: string;
    role: "TEACHER" | "STUDENT";
    content: string;
    createdAt: string;
    likes: number;
    liked?: boolean;
    isVerified?: boolean;
  }>;
};

export type ForumViewer = {
  id?: string;
  name: string;
  role: "TEACHER" | "STUDENT";
  className?: string;
} | null;

interface DiscussionForumProps {
  moduleId: string;
  courseSlug?: string;
  moduleTitle?: string;
  currentUser?: ForumViewer;
  /** Guru pemilik pembelajaran: boleh menghapus semua pertanyaan/tanggapan. */
  canModerate?: boolean;
}

const POLL_INTERVAL = 6000;

export function DiscussionForum({
  moduleId,
  courseSlug,
  moduleTitle,
  currentUser,
  canModerate = false,
}: DiscussionForumProps) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [activeReplyPostId, setActiveReplyPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  const authorName = currentUser?.name ?? "Tamu";

  const load = useCallback(
    async (silent = false) => {
      if (busy.current) return;
      // Jangan memanggil server saat tab tidak terlihat — hemat koneksi database.
      if (silent && typeof document !== "undefined" && document.visibilityState === "hidden") return;
      busy.current = true;
      if (!silent) setLoading(true);
      try {
        const data = await getForumPostsByModule(moduleId, courseSlug);
        setPosts(data);
      } catch {
        if (!silent) setPosts([]);
      } finally {
        busy.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [moduleId, courseSlug]
  );

  // Muat diskusi modul + sinkronkan berkala supaya terasa live.
  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), POLL_INTERVAL);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  async function handleCreatePost(event: React.FormEvent) {
    event.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || submitting) return;

    setSubmitting(true);
    setError("");
    const result = await createForumPost({
      moduleId,
      courseSlug,
      title: newTitle,
      content: newContent,
      guestName: authorName,
      guestClass: currentUser?.className,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Gagal mengirim pertanyaan.");
      return;
    }
    setNewTitle("");
    setNewContent("");
    setShowNewPost(false);
    await load(true);
  }

  async function handleAddReply(postId: string) {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    const result = await replyForumPost({
      postId,
      content: replyText,
      guestName: authorName,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Gagal mengirim tanggapan.");
      return;
    }
    setReplyText("");
    setActiveReplyPostId(null);
    await load(true);
  }

  async function handleDeletePost(postId: string) {
    if (!window.confirm("Hapus pertanyaan ini beserta seluruh tanggapannya?")) return;
    const result = await deleteForumPost(postId);
    if (!result.ok) {
      setError(result.error ?? "Gagal menghapus pertanyaan.");
      return;
    }
    await load(true);
  }

  async function handleDeleteReply(replyId: string) {
    if (!window.confirm("Hapus tanggapan ini?")) return;
    const result = await deleteForumReply(replyId);
    if (!result.ok) {
      setError(result.error ?? "Gagal menghapus tanggapan.");
      return;
    }
    await load(true);
  }

  async function likePost(postId: string) {
    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post))
    );
    await toggleLikePost(postId).catch(() => {});
  }

  async function likeReply(postId: string, replyId: string) {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              replies: post.replies.map((reply) =>
                reply.id === replyId
                  ? { ...reply, liked: !reply.liked, likes: reply.likes + (reply.liked ? -1 : 1) }
                  : reply
              ),
            }
          : post
      )
    );
    await toggleLikeReply(replyId).catch(() => {});
  }

  function canDelete(authorId?: string, role?: string) {
    if (canModerate) return true;
    if (!currentUser?.id || !authorId) return false;
    return role === "STUDENT" && authorId === currentUser.id;
  }

  return (
    <div className="discussion-forum">
      <div className="discussion-forum__top">
        <div>
          <div className="eyebrow" style={{ color: "var(--violet)" }}>
            RUANG DISKUSI MODUL
          </div>
          <h2>{moduleTitle ? `Forum Diskusi · ${moduleTitle}` : "Forum Diskusi Modul"}</h2>
          <p>
            Setiap modul punya forum sendiri. Tanyakan bagian yang belum kamu pahami dan diskusikan bersama guru
            serta teman sekelas.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="icon-button icon-button--tiny"
            onClick={() => {
              setRefreshing(true);
              load(true);
            }}
            aria-label="Segarkan diskusi"
          >
            <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
          </button>
          <button type="button" className="button button--primary" onClick={() => setShowNewPost((s) => !s)}>
            <Plus size={16} /> {showNewPost ? "Batal" : "Buat Pertanyaan"}
          </button>
        </div>
      </div>

      {error && <div className="preview-result is-warning">{error}</div>}

      {loading && (
        <div className="forum-loading">
          <Loader2 size={16} className="spin" />
          <span>Memuat diskusi khusus modul ini...</span>
        </div>
      )}

      {showNewPost && (
        <form className="new-post-card" onSubmit={handleCreatePost}>
          <h4>Tulis Pertanyaan Baru di Modul Ini</h4>
          <input
            type="text"
            placeholder="Judul pertanyaan (misalnya: Mengapa (-2) × (-3) = 6?)"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            required
          />
          <textarea
            placeholder="Jelaskan pertanyaanmu atau bagian mana dari materi yang masih membingungkan..."
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            rows={3}
            required
          />
          <div className="new-post-actions">
            <button type="button" className="button button--ghost button--small" onClick={() => setShowNewPost(false)}>
              Batal
            </button>
            <button type="submit" className="button button--primary button--small" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Terbitkan Pertanyaan
            </button>
          </div>
        </form>
      )}

      {!loading && posts.length === 0 && (
        <div className="empty-state">
          <MessageCircle size={24} />
          <strong>Forum modul ini masih kosong</strong>
          <p>Jadilah yang pertama bertanya. Diskusi ini hanya berisi topik dari modul ini.</p>
        </div>
      )}

      <div className="post-list">
        {posts.map((post) => (
          <div key={post.id} className="post-card">
            <div className="post-header">
              <div className="author-meta">
                <span className="author-avatar">{post.role === "TEACHER" ? "G" : "S"}</span>
                <div>
                  <strong>{post.author}</strong>
                  <small>
                    {post.role === "TEACHER" ? "Guru" : `Siswa ${post.className || ""}`} · {post.createdAt}
                  </small>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  className={`like-button ${post.liked ? "is-liked" : ""}`}
                  onClick={() => likePost(post.id)}
                >
                  <Heart size={14} /> <span>{post.likes}</span>
                </button>
                {canDelete(post.authorId, post.role) && (
                  <button
                    type="button"
                    className="icon-button icon-button--tiny"
                    onClick={() => handleDeletePost(post.id)}
                    aria-label="Hapus pertanyaan"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            <h3 className="post-title">{post.title}</h3>
            <p className="post-body">{post.content}</p>

            <div className="replies-section">
              <div className="replies-count">
                <MessageCircle size={14} /> {post.replies.length} Tanggapan
              </div>

              {post.replies.map((reply) => (
                <div key={reply.id} className={`reply-card ${reply.role === "TEACHER" ? "is-teacher" : ""}`}>
                  <div className="reply-header">
                    <div className="author-meta">
                      <span className="author-avatar author-avatar--sm">{reply.role === "TEACHER" ? "G" : "S"}</span>
                      <div>
                        <strong>{reply.author}</strong>
                        {reply.isVerified && (
                          <span className="verified-badge">
                            <CheckCircle2 size={12} /> Jawaban Guru
                          </span>
                        )}
                        <small> · {reply.createdAt}</small>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className={`like-button like-button--sm ${reply.liked ? "is-liked" : ""}`}
                        onClick={() => likeReply(post.id, reply.id)}
                      >
                        <Heart size={12} /> {reply.likes}
                      </button>
                      {canDelete(reply.authorId, reply.role) && (
                        <button
                          type="button"
                          className="icon-button icon-button--tiny"
                          onClick={() => handleDeleteReply(reply.id)}
                          aria-label="Hapus tanggapan"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="reply-body">{reply.content}</p>
                </div>
              ))}

              {activeReplyPostId === post.id ? (
                <div className="reply-form">
                  <textarea
                    placeholder="Tulis jawaban atau saran penjelasanmu..."
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={2}
                    autoFocus
                  />
                  <div className="reply-form-actions">
                    <button type="button" className="button button--ghost button--small" onClick={() => setActiveReplyPostId(null)}>
                      Batal
                    </button>
                    <button
                      type="button"
                      className="button button--primary button--small"
                      onClick={() => handleAddReply(post.id)}
                      disabled={submitting}
                    >
                      Kirim Tanggapan
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="open-reply-btn"
                  onClick={() => {
                    setActiveReplyPostId(post.id);
                    setReplyText("");
                  }}
                >
                  <MessageSquare size={13} /> Tambah tanggapan untuk diskusi ini...
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
