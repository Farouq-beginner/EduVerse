"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Heart,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  User,
} from "lucide-react";

export type ForumPost = {
  id: string;
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
    author: string;
    role: "TEACHER" | "STUDENT";
    content: string;
    createdAt: string;
    likes: number;
    liked?: boolean;
    isVerified?: boolean;
  }>;
};

const initialPosts: ForumPost[] = [
  {
    id: "q-1",
    author: "Raka Wijaya",
    role: "STUDENT",
    className: "VII-B",
    title: "Mengapa (-2) × (-3) = 6? Dari mana tanda positifnya datang?",
    content:
      "Halo teman-teman dan Ibu/Bapak guru. Saya masih bingung mengapa perkalian dua bilangan negatif hasilnya malah bilangan positif? Apakah ada analogi cerita atau garis bilangannya?",
    createdAt: "2 jam yang lalu",
    likes: 5,
    replies: [
      {
        id: "r-1",
        author: "Farouq Sensei",
        role: "TEACHER",
        content:
          "Pertanyaan hebat, Raka! Coba bayangkan analogi video film: Jika kita memutar mundur (negatif) rekaman seseorang yang sedang berjalan mundur (negatif), maka di layar orang tersebut tampak berjalan maju (positif)! Secara pola matematika: 2 × (-3) = -6, 1 × (-3) = -3, 0 × (-3) = 0. Setiap pengali berkurang 1, hasilnya selalu bertambah 3. Maka (-1) × (-3) = +3, dan (-2) × (-3) = +6.",
        createdAt: "1 jam yang lalu",
        likes: 12,
        isVerified: true,
      },
      {
        id: "r-2",
        author: "Alya Pramesti",
        role: "STUDENT",
        content:
          "Penjelasan Pak Guru sangat jelas! Aku biasanya mengingatnya dengan kalimat: 'Menolak kebohongan adalah kebenaran' (negatif bertemu negatif jadi positif).",
        createdAt: "45 menit yang lalu",
        likes: 3,
      },
    ],
  },
  {
    id: "q-2",
    author: "Bima Akbar",
    role: "STUDENT",
    className: "VII-B",
    title: "Bagaimana cara cepat menentukan arah pada operasi -5 - (-8)?",
    content:
      "Kadang saya tertukar saat ada dua tanda minus berdekatan seperti -5 - (-8). Kapan bergerak ke kiri dan kapan ke kanan di garis bilangan?",
    createdAt: "Kemarin",
    likes: 4,
    replies: [
      {
        id: "r-3",
        author: "Guru Satu",
        role: "TEACHER",
        content:
          "Ingat prinsip lawan bilangan, Bima: Mengurangkan bilangan sama dengan MENJUMLAHKAN LAWANNYA. Lawan dari (-8) adalah +8. Jadi -5 - (-8) diubah menjadi -5 + 8. Di garis bilangan: mulai dari -5, lalu melangkah 8 satuan ke kanan. Hasil akhirnya adalah +3.",
        createdAt: "Kemarin",
        likes: 7,
        isVerified: true,
      },
    ],
  },
];

interface DiscussionForumProps {
  moduleId?: string;
  courseSlug?: string;
  moduleTitle?: string;
  currentUser?: { name: string; role: "TEACHER" | "STUDENT"; className?: string } | null;
}

export function DiscussionForum({
  moduleId = "general",
  courseSlug = "operasi-bilangan-bulat",
  moduleTitle,
  currentUser,
}: DiscussionForumProps) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [activeReplyPostId, setActiveReplyPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authorName = currentUser?.name || "Kamu (Siswa)";
  const authorRole = currentUser?.role || "STUDENT";

  // Muat data forum untuk modul ini
  useEffect(() => {
    let active = true;
    setLoading(true);

    import("@/lib/actions/forum").then(({ getForumPostsByModule }) => {
      getForumPostsByModule(moduleId, courseSlug)
        .then((data) => {
          if (!active) return;
          if (data && data.length > 0) {
            setPosts(data);
          } else {
            // Filter demo sesuai modul jika belum ada di database
            const fallback = initialPosts.filter(
              (p) => moduleId === "general" || p.id.includes(moduleId) || true
            );
            setPosts(fallback);
          }
        })
        .catch(() => {
          if (active) setPosts(initialPosts);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, [moduleId, courseSlug]);

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || submitting) return;

    setSubmitting(true);
    const { createForumPost } = await import("@/lib/actions/forum");
    await createForumPost({
      moduleId,
      courseSlug,
      title: newTitle.trim(),
      content: newContent.trim(),
    });

    // Perbarui state lokal seketika
    const newPost: ForumPost = {
      id: "fp-" + Date.now(),
      author: authorName,
      role: authorRole,
      className: currentUser?.className || "VII-B",
      title: newTitle.trim(),
      content: newContent.trim(),
      createdAt: "Baru saja",
      likes: 0,
      replies: [],
    };

    setPosts([newPost, ...posts]);
    setNewTitle("");
    setNewContent("");
    setShowNewPost(false);
    setSubmitting(false);
  }

  async function handleAddReply(postId: string) {
    if (!replyText.trim() || submitting) return;

    setSubmitting(true);
    const { replyForumPost } = await import("@/lib/actions/forum");
    await replyForumPost({ postId, content: replyText.trim() });

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          replies: [
            ...p.replies,
            {
              id: "fr-" + Date.now(),
              author: authorName,
              role: authorRole,
              content: replyText.trim(),
              createdAt: "Baru saja",
              likes: 0,
              isVerified: authorRole === "TEACHER",
            },
          ],
        };
      })
    );

    setReplyText("");
    setActiveReplyPostId(null);
    setSubmitting(false);
  }

  async function toggleLikePost(postId: string) {
    const { toggleLikePost: serverLike } = await import("@/lib/actions/forum");
    serverLike(postId).catch(() => {});

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          liked: !p.liked,
          likes: p.liked ? p.likes - 1 : p.likes + 1,
        };
      })
    );
  }

  async function toggleLikeReply(postId: string, replyId: string) {
    const { toggleLikeReply: serverLike } = await import("@/lib/actions/forum");
    serverLike(replyId).catch(() => {});

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          replies: p.replies.map((r) => {
            if (r.id !== replyId) return r;
            return {
              ...r,
              liked: !r.liked,
              likes: r.liked ? r.likes - 1 : r.likes + 1,
            };
          }),
        };
      })
    );
  }

  return (
    <div className="discussion-forum">
      <div className="discussion-forum__top">
        <div>
          <div className="eyebrow" style={{ color: "var(--violet)" }}>
            RUANG DISKUSI MODUL
          </div>
          <h2>{moduleTitle ? `Forum Diskusi · ${moduleTitle}` : "Forum Tanya & Jawab Operasi Bilangan"}</h2>
          <p>
            Ada konsep yang belum kamu pahami di modul ini? Tanyakan di sini dan diskusikan bersama guru serta
            teman sekelas.
          </p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setShowNewPost((s) => !s)}
        >
          <Plus size={16} /> {showNewPost ? "Batal" : "Buat Pertanyaan"}
        </button>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: "0.85rem", padding: "12px 0" }}>
          <Sparkles size={16} className="spin" />
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
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Jelaskan pertanyaanmu atau bagian mana dari materi garis bilangan yang masih membingungkan..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            required
          />
          <div className="new-post-actions">
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => setShowNewPost(false)}
            >
              Batal
            </button>
            <button type="submit" className="button button--primary button--small">
              <Send size={14} /> Terbitkan Pertanyaan
            </button>
          </div>
        </form>
      )}

      <div className="post-list">
        {posts.map((post) => (
          <div key={post.id} className="post-card">
            <div className="post-header">
              <div className="author-meta">
                <span className="author-avatar">
                  {post.role === "TEACHER" ? "G" : "S"}
                </span>
                <div>
                  <strong>{post.author}</strong>
                  <small>
                    {post.role === "TEACHER" ? "Guru Matematika" : `Siswa ${post.className || ""}`} ·{" "}
                    {post.createdAt}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className={`like-button ${post.liked ? "is-liked" : ""}`}
                onClick={() => toggleLikePost(post.id)}
              >
                <Heart size={14} /> <span>{post.likes}</span>
              </button>
            </div>

            <h3 className="post-title">{post.title}</h3>
            <p className="post-body">{post.content}</p>

            {/* Replies section */}
            <div className="replies-section">
              <div className="replies-count">
                <MessageCircle size={14} /> {post.replies.length} Tanggapan
              </div>

              {post.replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`reply-card ${reply.role === "TEACHER" ? "is-teacher" : ""}`}
                >
                  <div className="reply-header">
                    <div className="author-meta">
                      <span className="author-avatar author-avatar--sm">
                        {reply.role === "TEACHER" ? "G" : "S"}
                      </span>
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
                    <button
                      type="button"
                      className={`like-button like-button--sm ${reply.liked ? "is-liked" : ""}`}
                      onClick={() => toggleLikeReply(post.id, reply.id)}
                    >
                      <Heart size={12} /> {reply.likes}
                    </button>
                  </div>
                  <p className="reply-body">{reply.content}</p>
                </div>
              ))}

              {/* Reply Form */}
              {activeReplyPostId === post.id ? (
                <div className="reply-form">
                  <textarea
                    placeholder="Tulis jawaban atau saran penjelasanmu..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    autoFocus
                  />
                  <div className="reply-form-actions">
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => setActiveReplyPostId(null)}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="button button--primary button--small"
                      onClick={() => handleAddReply(post.id)}
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
