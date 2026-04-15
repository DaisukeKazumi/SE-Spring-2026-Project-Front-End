// =============================================================
// script.js — SE Spring 2026 Frontend App
// =============================================================
// This file initialises the Supabase client and wires up the
// UI.  All Supabase calls live in clearly labelled helper
// functions so the logic is easy to extend.
// =============================================================

// -------------------------------------------------------
// 1.  SUPABASE CLIENT CONFIGURATION
// -------------------------------------------------------
const SUPABASE_URL  = "https://emlogmnygnpvtzfgyjet.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbG9nbW55Z25wdnR6Zmd5amV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDcwNzUsImV4cCI6MjA5MDM4MzA3NX0.xBe-Bmww1HTEpth3iUKfSGnXfwRejiSoV_COymxo-hE";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------------------------------
// 2.  CONSTANTS
// -------------------------------------------------------
const MAX_POST_WORDS = 1024;
const MIN_USERNAME_LENGTH = 3;

// Current user state
let currentUser = null;
// Cache: user_id -> username
let usernameCache = {};
// Cache: post_id -> true (posts the current user has liked)
let userLikes = {};

// -------------------------------------------------------
// 3.  AUTH HELPERS
// -------------------------------------------------------

async function signUpUser(email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  return { user: data?.user ?? null, error };
}

async function loginUser(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return { user: data?.user ?? null, error };
}

async function logoutUser() {
  const { error } = await db.auth.signOut();
  return { error };
}

// -------------------------------------------------------
// 4.  PROFILE HELPERS
// -------------------------------------------------------

async function fetchProfile(userId) {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return { profile: data ?? null, error };
}

function normalizeUsername(raw) {
  return raw.trim().toLowerCase();
}

async function saveUsername(userId, rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (username.length < MIN_USERNAME_LENGTH) {
    return {
      profile: null,
      error: { message: "Username must be at least " + MIN_USERNAME_LENGTH + " characters." },
    };
  }
  const { data, error } = await db
    .from("profiles")
    .upsert({ id: userId, username })
    .select()
    .single();
  return { profile: data ?? null, error };
}

async function getOrPromptUsername(user) {
  const { profile, error } = await fetchProfile(user.id);
  if (error) {
    console.error("Failed to fetch profile:", error.message);
  }
  if (profile?.username && profile.username.trim().length > 0) {
    userInfo.textContent = "Signed in as: @" + profile.username;
    return;
  }
  usernameOverlay.classList.remove("hidden");
}

/**
 * Fetch usernames for a list of user IDs and cache them.
 */
async function fetchUsernames(userIds) {
  const uncached = userIds.filter(function (id) { return !usernameCache[id]; });
  if (uncached.length === 0) return;

  const { data, error } = await db
    .from("profiles")
    .select("id, username")
    .in("id", uncached);

  if (error) {
    console.error("Failed to fetch usernames:", error.message);
    return;
  }
  if (data) {
    data.forEach(function (p) {
      usernameCache[p.id] = p.username || null;
    });
  }
}

function getDisplayName(userId) {
  var name = usernameCache[userId];
  if (name && name.trim().length > 0) return "@" + name;
  if (userId && typeof userId === "string" && userId.length >= 6) {
    return "User " + userId.substring(0, 6);
  }
  return "User";
}

// -------------------------------------------------------
// 5.  POST HELPERS
// -------------------------------------------------------

async function fetchPosts() {
  const { data, error } = await db
    .from("posts_with_counters")
    .select("*")
    .order("created_at", { ascending: false });
  return { data, error };
}

async function insertPost(content) {
  const { data, error } = await db
    .from("posts")
    .insert([{ content: content }])
    .select();
  return { data, error };
}

async function updatePost(postId, content) {
  const { data, error } = await db
    .from("posts")
    .update({ content: content })
    .eq("id", postId)
    .select();
  return { data, error };
}

async function deletePost(postId) {
  const { error } = await db
    .from("posts")
    .delete()
    .eq("id", postId);
  return { error };
}

// -------------------------------------------------------
// 6.  COMMENT HELPERS
// -------------------------------------------------------

async function fetchComments(postId) {
  const { data, error } = await db
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return { data, error };
}

async function insertComment(postId, content) {
  const { data, error } = await db
    .from("post_comments")
    .insert([{ post_id: postId, content: content }])
    .select();
  return { data, error };
}

async function updateComment(commentId, content) {
  const { data, error } = await db
    .from("post_comments")
    .update({ content: content, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .select();
  return { data, error };
}

async function deleteComment(commentId) {
  const { error } = await db
    .from("post_comments")
    .delete()
    .eq("id", commentId);
  return { error };
}

// -------------------------------------------------------
// 7.  LIKE HELPERS
// -------------------------------------------------------

async function fetchUserLikes(userId) {
  const { data, error } = await db
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId);
  if (error) {
    console.error("Failed to fetch likes:", error.message);
    return;
  }
  userLikes = {};
  if (data) {
    data.forEach(function (row) {
      userLikes[row.post_id] = true;
    });
  }
}

async function likePost(postId) {
  const { error } = await db
    .from("post_likes")
    .insert([{ post_id: postId, user_id: currentUser.id }]);
  return { error };
}

async function unlikePost(postId) {
  const { error } = await db
    .from("post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", currentUser.id);
  return { error };
}

// -------------------------------------------------------
// 8.  TEXT / CONTENT HELPERS
// -------------------------------------------------------

function countWords(text) {
  var trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Safely render post/comment content with clickable links using DOM nodes.
 * Returns a DocumentFragment (not an HTML string) to avoid innerHTML XSS risks.
 * Optionally embeds YouTube videos.
 */
function renderSafeContentNodes(text) {
  var fragment = document.createDocumentFragment();
  // Match http/https URLs
  var urlPattern = /(\bhttps?:\/\/[^\s<>"']+)/gi;
  var lastIndex = 0;
  var match;

  while ((match = urlPattern.exec(text)) !== null) {
    // Add text before the URL as a text node
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
    }

    var url = match[1];

    // Check for YouTube embed
    var youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      // Create clickable link
      var link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = url;
      fragment.appendChild(link);

      // Create YouTube embed preview
      var wrapper = document.createElement("div");
      wrapper.style.cssText = "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;margin:0.5rem 0;border-radius:8px;";
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + youtubeId;
      iframe.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px;";
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("sandbox", "allow-scripts allow-presentation");
      wrapper.appendChild(iframe);
      fragment.appendChild(wrapper);
    } else {
      // Regular link
      var anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = url;
      fragment.appendChild(anchor);
    }

    lastIndex = urlPattern.lastIndex;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }

  return fragment;
}

/**
 * Extract YouTube video ID from common YouTube URL formats.
 * Returns null if not a YouTube URL.
 */
function extractYouTubeId(url) {
  var patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{10,12})/
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = url.match(patterns[i]);
    if (m) return m[1];
  }
  return null;
}

var MS_PER_MINUTE = 60000;
var MS_PER_HOUR   = 3600000;
var MS_PER_DAY    = 86400000;
var MS_PER_WEEK   = 604800000;

function formatTime(isoString) {
  var d = new Date(isoString);
  var diff = Date.now() - d.getTime();
  if (diff < MS_PER_MINUTE)  return "just now";
  if (diff < MS_PER_HOUR)    return Math.floor(diff / MS_PER_MINUTE) + " min ago";
  if (diff < MS_PER_DAY)     return Math.floor(diff / MS_PER_HOUR) + " h ago";
  if (diff < MS_PER_WEEK)    return Math.floor(diff / MS_PER_DAY) + " d ago";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fullDateTime(isoString) {
  return new Date(isoString).toLocaleString();
}

// -------------------------------------------------------
// 9.  UI HELPERS
// -------------------------------------------------------

function setMessage(el, text, type) {
  if (!type) type = "";
  el.textContent = text;
  el.className = "message " + type;
}

function showSection(section) {
  authSection.classList.toggle("hidden", section !== "auth");
}

function updateWordCounter(textarea, counterEl) {
  var words = countWords(textarea.value);
  counterEl.textContent = words + " / " + MAX_POST_WORDS + " words";
  if (words > MAX_POST_WORDS) {
    counterEl.classList.add("over-limit");
  } else {
    counterEl.classList.remove("over-limit");
  }
}

// -------------------------------------------------------
// 10. FEED RENDERING
// -------------------------------------------------------

function renderFeed(posts) {
  feedList.innerHTML = "";
  if (!posts || posts.length === 0) {
    var p = document.createElement("p");
    p.className = "feed-empty";
    p.textContent = "No posts yet. Be the first to post!";
    feedList.appendChild(p);
    return;
  }

  posts.forEach(function (post) {
    var card = createPostCard(post);
    feedList.appendChild(card);
  });
}

function createPostCard(post) {
  var card = document.createElement("article");
  card.className = "post-card";
  card.dataset.postId = post.id;

  // ── Header ──────────────────────────────────────────────
  var header = document.createElement("div");
  header.className = "post-header";

  // Left side: avatar + meta
  var headerLeft = document.createElement("div");
  headerLeft.className = "post-header-left";

  // Avatar circle with first letter of username
  var displayName = getDisplayName(post.user_id);
  var avatar = document.createElement("div");
  avatar.className = "post-avatar";
  var initials = displayName.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  avatar.textContent = initials;

  // Username + timestamp stacked
  var meta = document.createElement("div");
  meta.className = "post-meta";

  var author = document.createElement("span");
  author.className = "post-author";
  author.textContent = displayName;

  var time = document.createElement("span");
  time.className = "post-time";
  time.textContent = formatTime(post.created_at);
  time.title = fullDateTime(post.created_at); // full date on hover

  meta.appendChild(author);
  meta.appendChild(time);

  headerLeft.appendChild(avatar);
  headerLeft.appendChild(meta);

  // Right side: edit/delete (only for post author)
  var headerRight = document.createElement("div");
  headerRight.className = "post-header-right";

  if (currentUser && currentUser.id === post.user_id) {
    var editBtn = document.createElement("button");
    editBtn.className = "btn btn-tiny btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openEditPostModal(post);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-tiny btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      handleDeletePost(post.id);
    });

    headerRight.appendChild(editBtn);
    headerRight.appendChild(deleteBtn);
  }

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // ── Content ──────────────────────────────────────────────
  var content = document.createElement("div");
  content.className = "post-content";
  content.appendChild(renderSafeContentNodes(post.content));

  // ── Action bar: like + comments ──────────────────────────
  var actions = document.createElement("div");
  actions.className = "post-actions";

  // Like button
  var likeBtn = document.createElement("button");
  likeBtn.className = "btn-like";
  var isLiked = currentUser && userLikes[post.id];
  if (isLiked) likeBtn.classList.add("liked");
  likeBtn.textContent = (isLiked ? "♥ Liked" : "♡ Like") + " (" + (post.like_count || 0) + ")";
  likeBtn.setAttribute("aria-label", (isLiked ? "Unlike post" : "Like post") + ", " + (post.like_count || 0) + " likes");
  if (!currentUser) {
    likeBtn.disabled = true;
    likeBtn.title = "Log in to like posts";
  }
  likeBtn.addEventListener("click", function () {
    handleLikeToggle(post.id, likeBtn);
  });

  // Comment toggle
  var commentBtn = document.createElement("button");
  commentBtn.className = "btn-comment-toggle";
  commentBtn.textContent = "💬 " + (post.comment_count || 0);
  commentBtn.title = "Toggle comments";
  commentBtn.setAttribute("aria-label", "Toggle comments, " + (post.comment_count || 0) + " comments");
  commentBtn.addEventListener("click", function () {
    toggleComments(post.id, card);
  });

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);

  // ── Comments section (hidden by default) ─────────────────
  var commentsSection = document.createElement("div");
  commentsSection.className = "comments-section hidden";
  commentsSection.id = "comments-" + post.id;

  // ── Assemble ─────────────────────────────────────────────
  card.appendChild(header);
  card.appendChild(content);
  card.appendChild(actions);
  card.appendChild(commentsSection);

  return card;
}

// -------------------------------------------------------
// 11. LIKE HANDLER
// -------------------------------------------------------

async function handleLikeToggle(postId, btn) {
  if (!currentUser) {
    alert("Please log in to like posts.");
    return;
  }

  btn.disabled = true;

  if (userLikes[postId]) {
    var unlikeResult = await unlikePost(postId);
    if (!unlikeResult.error) {
      delete userLikes[postId];
    }
  } else {
    var likeResult = await likePost(postId);
    if (!likeResult.error) {
      userLikes[postId] = true;
    }
  }

  btn.disabled = false;
  // Refresh feed to update counts
  await loadFeed();
}

// -------------------------------------------------------
// 12. COMMENT UI
// -------------------------------------------------------

async function toggleComments(postId, card) {
  var section = card.querySelector(".comments-section");
  if (!section.classList.contains("hidden")) {
    section.classList.add("hidden");
    return;
  }
  section.classList.remove("hidden");
  await loadComments(postId, section);
}

async function loadComments(postId, section) {
  section.innerHTML = '<p class="loading-text">Loading comments…</p>';

  var result = await fetchComments(postId);
  if (result.error) {
    section.innerHTML = '<p class="message error">Failed to load comments.</p>';
    return;
  }

  var comments = result.data || [];

  // Fetch usernames for comment authors
  var commentUserIds = comments.map(function (c) { return c.user_id; });
  await fetchUsernames(commentUserIds);

  section.innerHTML = "";

  // Render comments
  if (comments.length === 0) {
    var empty = document.createElement("p");
    empty.className = "no-comments";
    empty.textContent = "No comments yet.";
    section.appendChild(empty);
  } else {
    comments.forEach(function (comment) {
      var commentEl = createCommentElement(comment, postId, section);
      section.appendChild(commentEl);
    });
  }

  // Add comment form (if logged in)
  if (currentUser) {
    var form = createAddCommentForm(postId, section);
    section.appendChild(form);
  }
}

function createCommentElement(comment, postId, section) {
  var div = document.createElement("div");
  div.className = "comment-item";

  var header = document.createElement("div");
  header.className = "comment-header";

  var authorSpan = document.createElement("span");
  authorSpan.className = "comment-author";
  authorSpan.textContent = getDisplayName(comment.user_id);

  var timeSpan = document.createElement("span");
  timeSpan.className = "comment-time";
  var timeText = formatTime(comment.created_at);
  if (comment.updated_at) {
    timeText += " (edited)";
  }
  timeSpan.textContent = timeText;

  header.appendChild(authorSpan);
  header.appendChild(timeSpan);

  var body = document.createElement("div");
  body.className = "comment-body";
  body.appendChild(renderSafeContentNodes(comment.content));

  div.appendChild(header);
  div.appendChild(body);

  // Edit/delete for own comments
  if (currentUser && currentUser.id === comment.user_id) {
    var controls = document.createElement("div");
    controls.className = "comment-controls";

    var editBtn = document.createElement("button");
    editBtn.className = "btn btn-tiny btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      startEditComment(comment, div, postId, section);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-tiny btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async function () {
      if (!confirm("Delete this comment?")) return;
      var res = await deleteComment(comment.id);
      if (!res.error) {
        await loadComments(postId, section);
        await loadFeed();
      }
    });

    controls.appendChild(editBtn);
    controls.appendChild(deleteBtn);
    div.appendChild(controls);
  }

  return div;
}

function startEditComment(comment, div, postId, section) {
  div.innerHTML = "";
  var form = document.createElement("form");
  form.className = "comment-edit-form";

  var input = document.createElement("textarea");
  input.className = "comment-input";
  input.rows = 2;
  input.value = comment.content;

  var btnGroup = document.createElement("div");
  btnGroup.className = "btn-group";

  var saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "btn btn-tiny btn-primary";
  saveBtn.textContent = "Save";

  var cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-tiny btn-secondary";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", function () {
    loadComments(postId, section);
  });

  btnGroup.appendChild(saveBtn);
  btnGroup.appendChild(cancelBtn);

  form.appendChild(input);
  form.appendChild(btnGroup);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var newContent = input.value.trim();
    if (!newContent) return;

    var words = countWords(newContent);
    if (words > MAX_POST_WORDS) {
      alert("Comment exceeds " + MAX_POST_WORDS + " word limit (" + words + " words). Please shorten it.");
      return;
    }

    saveBtn.disabled = true;
    var res = await updateComment(comment.id, newContent);
    saveBtn.disabled = false;
    if (!res.error) {
      await loadComments(postId, section);
    }
  });

  div.appendChild(form);
}

function createAddCommentForm(postId, section) {
  var form = document.createElement("form");
  form.className = "add-comment-form";

  var input = document.createElement("textarea");
  input.className = "comment-input";
  input.rows = 2;
  input.placeholder = "Write a comment…";
  input.required = true;

  var submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn-small btn-primary";
  submitBtn.textContent = "Comment";

  form.appendChild(input);
  form.appendChild(submitBtn);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var content = input.value.trim();
    if (!content) return;

    var words = countWords(content);
    if (words > MAX_POST_WORDS) {
      alert("Comment exceeds " + MAX_POST_WORDS + " word limit (" + words + " words). Please shorten it.");
      return;
    }

    submitBtn.disabled = true;
    var res = await insertComment(postId, content);
    submitBtn.disabled = false;
    if (!res.error) {
      input.value = "";
      await loadComments(postId, section);
      await loadFeed();
    }
  });

  return form;
}

// -------------------------------------------------------
// 13. POST EDIT / DELETE
// -------------------------------------------------------

let editingPostId = null;

function openEditPostModal(post) {
  editingPostId = post.id;
  editPostInput.value = post.content;
  updateWordCounter(editPostInput, editWordCounter);
  setMessage(editPostMessage, "", "");
  editPostOverlay.classList.remove("hidden");
}

async function handleDeletePost(postId) {
  if (!confirm("Delete this post? This cannot be undone.")) return;
  var result = await deletePost(postId);
  if (result.error) {
    alert("Failed to delete post: " + result.error.message);
  } else {
    await loadFeed();
  }
}

// -------------------------------------------------------
// 14. ELEMENT REFERENCES
// -------------------------------------------------------
var authSection       = document.getElementById("auth-section");
var createPostSection = document.getElementById("create-post-section");
var feedList          = document.getElementById("feed-list");
var emailInput        = document.getElementById("email");
var passwordInput     = document.getElementById("password");
var signupBtn         = document.getElementById("signup-btn");
var loginBtn          = document.getElementById("login-btn");
var logoutBtn         = document.getElementById("logout-btn");
var authMessage       = document.getElementById("auth-message");
var insertForm        = document.getElementById("insert-form");
var dataInput         = document.getElementById("data-input");
var dataMessage       = document.getElementById("data-message");
var wordCounter       = document.getElementById("word-counter");
var userInfo          = document.getElementById("user-info");
var usernameOverlay   = document.getElementById("username-overlay");
var usernameForm      = document.getElementById("username-form");
var usernameInput     = document.getElementById("username-input");
var usernameSubmitBtn = document.getElementById("username-submit-btn");
var usernameMessage   = document.getElementById("username-message");
var editPostOverlay   = document.getElementById("edit-post-overlay");
var editPostForm      = document.getElementById("edit-post-form");
var editPostInput     = document.getElementById("edit-post-input");
var editWordCounter   = document.getElementById("edit-word-counter");
var editPostCancel    = document.getElementById("edit-post-cancel");
var editPostMessage   = document.getElementById("edit-post-message");

// -------------------------------------------------------
// 15. EVENT LISTENERS
// -------------------------------------------------------

signupBtn.addEventListener("click", async function () {
  var email    = emailInput.value.trim();
  var password = passwordInput.value;
  if (!email || !password) return;

  var result = await signUpUser(email, password);
  if (result.error) {
    setMessage(authMessage, result.error.message, "error");
  } else {
    setMessage(
      authMessage,
      "Sign-up successful! Check your email to confirm, then log in.",
      "success"
    );
  }
});

loginBtn.addEventListener("click", async function () {
  var email    = emailInput.value.trim();
  var password = passwordInput.value;
  if (!email || !password) return;

  var result = await loginUser(email, password);
  if (result.error) {
    setMessage(authMessage, result.error.message, "error");
  } else {
    onLoggedIn(result.user);
  }
});

logoutBtn.addEventListener("click", async function () {
  var result = await logoutUser();
  if (!result.error) onLoggedOut();
});

// Word counter for post creation
dataInput.addEventListener("input", function () {
  updateWordCounter(dataInput, wordCounter);
});

// Word counter for post editing
editPostInput.addEventListener("input", function () {
  updateWordCounter(editPostInput, editWordCounter);
});

// Post creation
insertForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  var content = dataInput.value.trim();
  if (!content) return;

  var words = countWords(content);
  if (words > MAX_POST_WORDS) {
    setMessage(dataMessage, "Post exceeds " + MAX_POST_WORDS + " word limit (" + words + " words). Please shorten it.", "error");
    return;
  }

  var result = await insertPost(content);
  if (result.error) {
    setMessage(dataMessage, result.error.message, "error");
  } else {
    setMessage(dataMessage, "Post created!", "success");
    dataInput.value = "";
    updateWordCounter(dataInput, wordCounter);
    await loadFeed();
  }
});

// Post editing form
editPostForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  var content = editPostInput.value.trim();
  if (!content || !editingPostId) return;

  var words = countWords(content);
  if (words > MAX_POST_WORDS) {
    setMessage(editPostMessage, "Post exceeds " + MAX_POST_WORDS + " word limit (" + words + " words).", "error");
    return;
  }

  var result = await updatePost(editingPostId, content);
  if (result.error) {
    setMessage(editPostMessage, result.error.message, "error");
  } else {
    editPostOverlay.classList.add("hidden");
    editingPostId = null;
    await loadFeed();
  }
});

editPostCancel.addEventListener("click", function () {
  editPostOverlay.classList.add("hidden");
  editingPostId = null;
});

// Username form
usernameForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  var raw = usernameInput.value;
  var username = normalizeUsername(raw);

  if (username.length < MIN_USERNAME_LENGTH) {
    setMessage(usernameMessage, "Username must be at least " + MIN_USERNAME_LENGTH + " characters.", "error");
    return;
  }

  usernameSubmitBtn.disabled = true;
  usernameSubmitBtn.textContent = "Saving…";
  setMessage(usernameMessage, "", "");

  var authResult = await db.auth.getUser();
  var user = authResult.data.user;

  if (!user) {
    setMessage(usernameMessage, "You must be logged in.", "error");
    usernameSubmitBtn.disabled = false;
    usernameSubmitBtn.textContent = "Save Username";
    return;
  }

  var result = await saveUsername(user.id, username);
  usernameSubmitBtn.disabled = false;
  usernameSubmitBtn.textContent = "Save Username";

  if (result.error) {
    var msg =
      result.error.code === "23505"
        ? "That username is already taken. Please choose another."
        : result.error.message;
    setMessage(usernameMessage, msg, "error");
  } else {
    userInfo.textContent = "Signed in as: @" + result.profile.username;
    usernameOverlay.classList.add("hidden");
    usernameInput.value = "";
    setMessage(usernameMessage, "", "");
    // Update cache
    usernameCache[user.id] = result.profile.username;
    await loadFeed();
  }
});

// -------------------------------------------------------
// 16. SESSION MANAGEMENT
// -------------------------------------------------------

function onLoggedIn(user) {
  currentUser = user;
  userInfo.textContent = user.email;
  logoutBtn.classList.remove("hidden");
  authSection.classList.add("hidden");
  createPostSection.classList.remove("hidden");
  getOrPromptUsername(user);
  // Load user's likes, then refresh feed
  fetchUserLikes(user.id).then(function () { loadFeed(); });
}

function onLoggedOut() {
  currentUser = null;
  userLikes = {};
  userInfo.textContent = "";
  logoutBtn.classList.add("hidden");
  usernameOverlay.classList.add("hidden");
  createPostSection.classList.add("hidden");
  authSection.classList.remove("hidden");
  setMessage(authMessage, "", "");
  loadFeed();
}

async function loadFeed() {
  var result = await fetchPosts();
  if (result.error) {
    feedList.innerHTML = '<p class="message error">Failed to load posts.</p>';
    return;
  }

  var posts = result.data || [];

  // Collect unique user_ids and fetch usernames
  var userIds = [];
  posts.forEach(function (p) {
    if (userIds.indexOf(p.user_id) === -1) userIds.push(p.user_id);
  });
  await fetchUsernames(userIds);

  renderFeed(posts);
}

// Restore an existing session on page load
(async function () {
  var sessionResult = await db.auth.getSession();
  var session = sessionResult.data.session;
  if (session && session.user) {
    onLoggedIn(session.user);
  } else {
    authSection.classList.remove("hidden");
    loadFeed();
  }

  db.auth.onAuthStateChange(function (_event, session) {
    if (session && session.user) {
      onLoggedIn(session.user);
    } else {
      onLoggedOut();
    }
  });
})();
