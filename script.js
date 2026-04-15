// =============================================================
// script.js — SE Spring 2026 Frontend App
// =============================================================
// This file initialises the Supabase client and wires up the
// UI.  All Supabase calls live in clearly labelled helper
// functions so the logic is easy to extend.
// =============================================================

// -------------------------------------------------------
// 1.  SUPABASE CLIENT CONFIGURATION
//     Replace the placeholder values below with the real
//     Project URL and anon/public key from:
//       Supabase Dashboard → Project Settings → API
// -------------------------------------------------------
const SUPABASE_URL  = "https://emlogmnygnpvtzfgyjet.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbG9nbW55Z25wdnR6Zmd5amV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDcwNzUsImV4cCI6MjA5MDM4MzA3NX0.xBe-Bmww1HTEpth3iUKfSGnXfwRejiSoV_COymxo-hE";               // <-- replace

// Initialise the client (supabase-js is loaded via the CDN
// script tag in index.html and exposed as window.supabase).
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------------------------------------
// 2.  AUTH HELPERS
// -------------------------------------------------------

/**
 * Sign up a new user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, error: object|null}>}
 */
async function signUpUser(email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  return { user: data?.user ?? null, error };
}

/**
 * Log in an existing user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, error: object|null}>}
 */
async function loginUser(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return { user: data?.user ?? null, error };
}

/**
 * Log out the currently authenticated user.
 * @returns {Promise<{error: object|null}>}
 */
async function logoutUser() {
  const { error } = await db.auth.signOut();
  return { error };
}

// -------------------------------------------------------
// 2b. PROFILE HELPERS
// -------------------------------------------------------

const MIN_USERNAME_LENGTH = 3;

/**
 * Fetch the profile row for a given user id.
 * @param {string} userId
 * @returns {Promise<{profile: object|null, error: object|null}>}
 */
async function fetchProfile(userId) {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return { profile: data ?? null, error };
}

/**
 * Normalize a raw username string: trim whitespace and lowercase.
 * @param {string} raw
 * @returns {string}
 */
function normalizeUsername(raw) {
  return raw.trim().toLowerCase();
}

/**
 * Save (upsert) a username into public.profiles for the current user.
 * @param {string} userId
 * @param {string} rawUsername
 * @returns {Promise<{profile: object|null, error: object|null}>}
 */
async function saveUsername(userId, rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (username.length < MIN_USERNAME_LENGTH) {
    return {
      profile: null,
      error: { message: `Username must be at least ${MIN_USERNAME_LENGTH} characters.` },
    };
  }
  const { data, error } = await db
    .from("profiles")
    .upsert({ id: userId, username })
    .select()
    .single();
  return { profile: data ?? null, error };
}

/**
 * Check whether the user already has a username.
 * If not, show the username prompt overlay.
 * @param {object} user  The auth user object.
 */
async function getOrPromptUsername(user) {
  const { profile, error } = await fetchProfile(user.id);
  if (error) {
    console.error("Failed to fetch profile:", error.message);
  }
  if (profile?.username && profile.username.trim().length > 0) {
    userInfo.textContent = "Signed in as: @" + profile.username;
    return;
  }
  // Show the username overlay
  usernameOverlay.classList.remove("hidden");
}

// -------------------------------------------------------
// 3.  DATABASE HELPERS
//     Adjust the table name ("entries") to match your own
//     Supabase table.  Add/remove columns as needed.
// -------------------------------------------------------

const TABLE_NAME = "posts"; // <-- replace with your table name

/**
 * Insert a single row into the table.
 * @param {object} rowData  Plain object matching your table schema.
 *                          e.g. { content: "hello" }
 * @returns {Promise<{data: object[]|null, error: object|null}>}
 */
async function insertData(rowData) {
  const { data, error } = await db.from(TABLE_NAME).insert([rowData]).select();
  return { data, error };
}

/**
 * Fetch all rows from the table, ordered by created_at descending.
 * @returns {Promise<{data: object[]|null, error: object|null}>}
 */
async function fetchData() {
  const { data, error } = await db
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });
  return { data, error };
}

// -------------------------------------------------------
// 4.  UI HELPERS
// -------------------------------------------------------

/** Toggle visibility of the auth vs. data sections. */
function showSection(section) {
  authSection.classList.toggle("hidden", section !== "auth");
  dataSection.classList.toggle("hidden", section !== "data");
}

/** Display a message under a form. */
function setMessage(el, text, type = "") {
  el.textContent = text;
  el.className = "message " + type;
}

/** Populate the data list from an array of row objects. */
function renderDataList(rows) {
  dataList.innerHTML = "";
  if (!rows || rows.length === 0) {
    dataList.innerHTML = "<li>No entries yet.</li>";
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement("li");
    // Show all column values joined by " — ", skipping id/timestamp columns
    li.textContent = Object.entries(row)
      .filter(([k]) => !["id", "created_at", "user_id"].includes(k))
      .map(([, v]) => v)
      .join(" — ");
    dataList.appendChild(li);
  });
}

// -------------------------------------------------------
// 5.  ELEMENT REFERENCES
// -------------------------------------------------------
const authSection  = document.getElementById("auth-section");
const dataSection  = document.getElementById("data-section");
const emailInput   = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn    = document.getElementById("signup-btn");
const loginBtn     = document.getElementById("login-btn");
const logoutBtn    = document.getElementById("logout-btn");
const authMessage  = document.getElementById("auth-message");
const insertForm   = document.getElementById("insert-form");
const dataInput    = document.getElementById("data-input");
const dataMessage  = document.getElementById("data-message");
const dataList     = document.getElementById("data-list");
const userInfo     = document.getElementById("user-info");
const usernameOverlay = document.getElementById("username-overlay");
const usernameForm    = document.getElementById("username-form");
const usernameInput   = document.getElementById("username-input");
const usernameSubmitBtn = document.getElementById("username-submit-btn");
const usernameMessage = document.getElementById("username-message");

// -------------------------------------------------------
// 6.  EVENT LISTENERS
// -------------------------------------------------------

signupBtn.addEventListener("click", async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return;

  const { user, error } = await signUpUser(email, password);
  if (error) {
    setMessage(authMessage, error.message, "error");
  } else {
    setMessage(
      authMessage,
      "Sign-up successful! Check your email to confirm, then log in.",
      "success"
    );
  }
});

loginBtn.addEventListener("click", async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return;

  const { user, error } = await loginUser(email, password);
  if (error) {
    setMessage(authMessage, error.message, "error");
  } else {
    onLoggedIn(user);
  }
});

logoutBtn.addEventListener("click", async () => {
  const { error } = await logoutUser();
  if (!error) onLoggedOut();
});

insertForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = dataInput.value.trim();
  if (!content) return;

  const { data, error } = await insertData({ content });
  if (error) {
    setMessage(dataMessage, error.message, "error");
  } else {
    setMessage(dataMessage, "Entry added!", "success");
    dataInput.value = "";
    await loadAndRenderData();
  }
});

usernameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = usernameInput.value;
  const username = normalizeUsername(raw);

  if (username.length < MIN_USERNAME_LENGTH) {
    setMessage(usernameMessage, `Username must be at least ${MIN_USERNAME_LENGTH} characters.`, "error");
    return;
  }

  // Disable button while saving
  usernameSubmitBtn.disabled = true;
  usernameSubmitBtn.textContent = "Saving…";
  setMessage(usernameMessage, "", "");

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    setMessage(usernameMessage, "You must be logged in.", "error");
    usernameSubmitBtn.disabled = false;
    usernameSubmitBtn.textContent = "Save Username";
    return;
  }

  const { profile, error } = await saveUsername(user.id, username);
  usernameSubmitBtn.disabled = false;
  usernameSubmitBtn.textContent = "Save Username";

  if (error) {
    // Handle unique constraint violation
    const msg =
      error.code === "23505"
        ? "That username is already taken. Please choose another."
        : error.message;
    setMessage(usernameMessage, msg, "error");
  } else {
    // Success — update header and hide overlay
    userInfo.textContent = "Signed in as: @" + profile.username;
    usernameOverlay.classList.add("hidden");
    usernameInput.value = "";
    setMessage(usernameMessage, "", "");
  }
});

// -------------------------------------------------------
// 7.  SESSION MANAGEMENT
// -------------------------------------------------------

function onLoggedIn(user) {
  userInfo.textContent = user.email;
  logoutBtn.classList.remove("hidden");
  showSection("data");
  loadAndRenderData();
  getOrPromptUsername(user);
}

function onLoggedOut() {
  userInfo.textContent = "";
  logoutBtn.classList.add("hidden");
  usernameOverlay.classList.add("hidden");
  showSection("auth");
  setMessage(authMessage, "", "");
}

async function loadAndRenderData() {
  const { data, error } = await fetchData();
  if (error) {
    setMessage(dataMessage, error.message, "error");
  } else {
    renderDataList(data);
  }
}

// Restore an existing session on page load
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    onLoggedIn(session.user);
  } else {
    showSection("auth");
  }

  // Listen for auth state changes (e.g. email confirmation callback)
  db.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      onLoggedIn(session.user);
    } else {
      onLoggedOut();
    }
  });
})();
