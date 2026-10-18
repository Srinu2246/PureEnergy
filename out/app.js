import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// This is public client configuration; never put service-account credentials here.
const firebaseConfig = {
  storageBucket: "srinu2246-ddd87.firebasestorage.app",
  authDomain: "srinu2246-ddd87.firebaseapp.com",
  messagingSenderId: "510761229274",
  projectId: "srinu2246-ddd87",
  apiKey: "AIzaSyDehjYVoAbbJnqyzT0KfalSQ5MIzfgnGOY",
  appId: "1:510761229274:web:cf1512f3b2db845decbee3"
};

const FALLBACK_DEALERS = [
  { id: "D01", name: "Sri Sai Power Solutions", pincode_prefixes: "500" },
  { id: "D02", name: "Kandi Energy Point", pincode_prefixes: "502" },
  { id: "D03", name: "Warangal Green Systems", pincode_prefixes: "506" },
  { id: "D04", name: "Karimnagar Solar Hub", pincode_prefixes: "505" },
  { id: "D05", name: "Vizag Home Power", pincode_prefixes: "530|531" },
  { id: "D06", name: "Krishna Energy Store", pincode_prefixes: "520|521" },
  { id: "D07", name: "Guntur Battery World", pincode_prefixes: "522" },
  { id: "D08", name: "Tirupati PowerHouse", pincode_prefixes: "517" }
];
const STATUSES = ["New", "Contacted", "Converted", "Lost"];
const appNotice = document.getElementById("app-notice");
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const authNotice = document.getElementById("auth-notice");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authTitle = document.getElementById("auth-title");
const authDescription = document.getElementById("auth-description");
const authSubmit = document.getElementById("auth-submit");
const googleSignIn = document.getElementById("google-sign-in");
const authToggle = document.getElementById("auth-toggle");
const authTogglePrompt = document.getElementById("auth-toggle-prompt");
const signedInUser = document.getElementById("signed-in-user");
const userAvatar = document.getElementById("user-avatar");
const signOutButton = document.getElementById("sign-out-button");
const form = document.getElementById("lead-form");
const submitButton = document.getElementById("submit-button");
const formFeedback = document.getElementById("form-feedback");
const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, document.getElementById(`count-${status.toLowerCase()}`)]));

function showNotice(message) {
  appNotice.textContent = message;
  appNotice.hidden = false;
}

function showAuthNotice(message) {
  authNotice.textContent = message;
  authNotice.hidden = !message;
}

function authErrorMessage(error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages = {
    "auth/email-already-in-use": "An account already exists for this email. Sign in instead.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed": "Could not reach Firebase. Check your internet connection.",
    "auth/operation-not-allowed": "Enable Email/Password and Google under Firebase Console → Authentication → Sign-in method.",
    "auth/popup-blocked": "Allow popups for this site to continue with Google.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/unauthorized-domain": "Add this site’s domain to Firebase Authentication → Settings → Authorized domains.",
    "auth/weak-password": "Choose a password with at least 6 characters."
  };
  return messages[code] || "Authentication failed. Check your sign-in details and Firebase Authentication settings.";
}

let auth;
let db;
let unsubscribeLeads;
let unsubscribeDealers;
let dealers = FALLBACK_DEALERS;
let latestLeads = [];
let authMode = "signin";
function setAuthMode(mode) {
  authMode = mode;
  const isSignUp = mode === "signup";
  authTitle.textContent = isSignUp ? "Create your account" : "Welcome back";
  authDescription.textContent = isSignUp
    ? "Register with email and password to access the lead dashboard."
    : "Sign in to continue to your lead dashboard.";
  authSubmit.textContent = isSignUp ? "Create account" : "Sign in";
  authPassword.autocomplete = isSignUp ? "new-password" : "current-password";
  authTogglePrompt.textContent = isSignUp ? "Already have an account?" : "New to the workspace?";
  authToggle.textContent = isSignUp ? "Sign in" : "Create an account";
  showAuthNotice("");
}

function setAuthBusy(isBusy) {
  authSubmit.disabled = isBusy;
  googleSignIn.disabled = isBusy;
  authToggle.disabled = isBusy;
}

authToggle.addEventListener("click", () => {
  setAuthMode(authMode === "signin" ? "signup" : "signin");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return;
  showAuthNotice("");
  setAuthBusy(true);
  try {
    const email = authEmail.value.trim();
    if (authMode === "signup") {
      await createUserWithEmailAndPassword(auth, email, authPassword.value);
    } else {
      await signInWithEmailAndPassword(auth, email, authPassword.value);
    }
  } catch (error) {
    showAuthNotice(authErrorMessage(error));
  } finally {
    setAuthBusy(false);
  }
});

googleSignIn.addEventListener("click", async () => {
  if (!auth) return;
  showAuthNotice("");
  setAuthBusy(true);
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    showAuthNotice(authErrorMessage(error));
  } finally {
    setAuthBusy(false);
  }
});

signOutButton.addEventListener("click", async () => {
  if (!auth) return;
  signOutButton.disabled = true;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Firebase sign-out failed:", error);
    showNotice("Could not sign out. Please try again.");
  } finally {
    signOutButton.disabled = false;
  }
});

function assignDealer(pincode, dealerList = dealers) {
  const prefix = pincode.slice(0, 3);
  const dealer = dealerList.find((item) => item.pincode_prefixes.split("|").map((value) => value.trim()).includes(prefix));
  return dealer || { id: "INHOUSE", name: "In-house Sales" };
}

function normalizedMobile(value) {
  let phone = value.trim().replace(/[\s-]/g, "");
  if (phone.startsWith("+91")) phone = phone.slice(3);
  return phone;
}

function validateLead(values) {
  const errors = {};
  const phone = normalizedMobile(values.mobile);
  if (!values.name.trim()) errors.name = "Enter the customer's name.";
  if (!/^[0-9]{10}$/.test(phone)) errors.mobile = "Enter a valid 10-digit mobile number.";
  if (!/^[0-9]{6}$/.test(values.pincode.trim())) errors.pincode = "Enter a valid 6-digit pincode.";
  if (!values.product) errors.product = "Choose a product.";
  if (!values.source) errors.source = "Choose a lead source.";
  return { errors, phone, pincode: values.pincode.trim() };
}

function showValidation(errors) {
  for (const field of ["name", "mobile", "pincode", "product", "source"]) {
    const message = errors[field] || "";
    document.getElementById(`${field}-error`).textContent = message;
    document.getElementById(field).setAttribute("aria-invalid", String(Boolean(message)));
  }
}

function safeText(value) {
  return value == null ? "" : String(value);
}

function displayDate(value) {
  if (!value) return "â€”";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "â€”";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function renderDealerCounts(leads) {
  const counts = new Map(dealers.map((dealer) => [dealer.name, 0]));
  counts.set("In-house Sales", 0);
  for (const lead of leads) {
    const name = lead.dealer_name || "In-house Sales";
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const container = document.getElementById("dealer-counts");
  container.replaceChildren();
  for (const [name, count] of counts) {
    const item = document.createElement("div");
    item.className = "dealer-item";
    const title = document.createElement("strong");
    title.textContent = name === "In-house Sales" ? "In-house" : name;
    const detail = document.createElement("span");
    detail.textContent = `${count} ${count === 1 ? "lead" : "leads"}`;
    const total = document.createElement("b");
    total.textContent = String(count);
    detail.append(total);
    item.append(title, detail);
    container.append(item);
  }
  document.getElementById("dealer-count").textContent = String(counts.size);
}

function renderLeads(leads) {
  const rows = document.getElementById("lead-rows");
  rows.replaceChildren();
  document.getElementById("record-count").textContent = `${leads.length} ${leads.length === 1 ? "record" : "records"}`;

  if (leads.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "empty-table";
    cell.colSpan = 5;
    cell.textContent = "No leads yet. Add an enquiry to get started.";
    row.append(cell);
    rows.append(row);
    return;
  }

  for (const lead of leads) {
    const row = document.createElement("tr");
    const customerCell = document.createElement("td");
    const name = document.createElement("span");
    name.className = "customer-name";
    name.textContent = safeText(lead.name);
    const phone = document.createElement("span");
    phone.className = "customer-phone";
    phone.textContent = safeText(lead.phone);
    customerCell.append(name, phone);

    const productCell = document.createElement("td");
    productCell.textContent = safeText(lead.product) || "â€”";
    const dealerCell = document.createElement("td");
    dealerCell.className = "lead-dealer";
    dealerCell.textContent = safeText(lead.dealer_name) || "In-house Sales";
    const dateCell = document.createElement("td");
    dateCell.textContent = displayDate(lead.created_on);

    const statusCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = "status-select";
    select.setAttribute("aria-label", `Status for ${safeText(lead.name)}`);
    for (const status of STATUSES) {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      select.append(option);
    }
    select.value = STATUSES.includes(lead.status) ? lead.status : "New";
    select.addEventListener("change", async () => {
      select.disabled = true;
      try {
        await updateDoc(doc(db, "leads", lead.phone), { status: select.value });
      } catch (error) {
        console.error("Could not update lead status:", error);
        select.value = lead.status;
        showNotice("The lead status could not be updated. Check your connection and Firestore rules, then try again.");
      } finally {
        select.disabled = false;
      }
    });
    statusCell.append(select);
    row.append(customerCell, productCell, dealerCell, dateCell, statusCell);
    rows.append(row);
  }
}

function renderDashboard(snapshot) {
  const leads = snapshot.docs.map((leadDoc) => ({ ...leadDoc.data(), phone: leadDoc.id }));
  latestLeads = leads;
  document.getElementById("total-count").textContent = String(leads.length);
  for (const status of STATUSES) {
    statusCounts[status].textContent = String(leads.filter((lead) => lead.status === status).length);
  }
  renderDealerCounts(leads);
  renderLeads(leads);
}

function watchLeads() {
  unsubscribeLeads = onSnapshot(
    query(collection(db, "leads"), orderBy("created_on", "desc")),
    renderDashboard,
    (error) => {
      console.error("Could not load leads:", error);
      showNotice(error.code === "permission-denied"
        ? "Firestore denied access for this account. Check the account and Firestore rules."
        : "Could not load leads from Firestore. Check your internet connection and Firestore configuration.");
    }
  );
}

function watchDealers() {
  unsubscribeDealers = onSnapshot(
    collection(db, "dealers"),
    (snapshot) => {
      const invalidDealer = snapshot.docs.find((dealerDoc) => {
        const data = dealerDoc.data();
        return typeof data.name !== "string" || !data.name.trim() ||
          typeof data.pincode_prefixes !== "string" ||
          !/^[0-9]{3}(?:\|[0-9]{3})*$/.test(data.pincode_prefixes);
      });
      if (invalidDealer) {
        console.error("Invalid dealer document:", invalidDealer.id);
        dealers = FALLBACK_DEALERS;
        showNotice("A dealer record has invalid fields. Using the built-in list until the Firestore dealer data is corrected.");
        return;
      }
      const loadedDealers = snapshot.docs.map((dealerDoc) => {
        const data = dealerDoc.data();
        return { id: dealerDoc.id, name: data.name.trim(), pincode_prefixes: data.pincode_prefixes };
      });
      if (!loadedDealers.length) {
        dealers = FALLBACK_DEALERS;
        showNotice("No dealers are saved in Firestore yet. Using the built-in dealer list until dealers.csv is loaded.");
        return;
      }
      dealers = loadedDealers;
      if (appNotice.textContent.startsWith("No dealers are saved") ||
          appNotice.textContent.startsWith("A dealer record has invalid fields") ||
          appNotice.textContent.startsWith("Could not load dealers")) {
        appNotice.hidden = true;
      }
      renderDealerCounts(latestLeads);
    },
    (error) => {
      console.error("Could not load dealers:", error);
      dealers = FALLBACK_DEALERS;
      latestLeads = [];
      showNotice("Could not load dealers from Firestore. Using the built-in list; verify dealer routing data.");
    }
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db) {
    formFeedback.textContent = "Configure Firebase before creating leads.";
    formFeedback.classList.add("error");
    return;
  }
  formFeedback.textContent = "";
  formFeedback.classList.remove("error");
  const values = Object.fromEntries(new FormData(form));
  const { errors, phone, pincode } = validateLead(values);
  showValidation(errors);
  if (Object.keys(errors).length > 0) return;

  const dealer = assignDealer(pincode);
  const leadRef = doc(db, "leads", phone);
  const lead = {
    lead_id: phone,
    name: values.name.trim(),
    phone,
    pincode,
    product: values.product,
    source: values.source,
    status: "New",
    dealer_id: dealer.id,
    dealer_name: dealer.name,
    created_on: serverTimestamp()
  };

  submitButton.disabled = true;
  submitButton.textContent = "Saving leadâ€¦";
  try {
    await runTransaction(db, async (transaction) => {
      const existingLead = await transaction.get(leadRef);
      if (existingLead.exists()) throw new Error("DUPLICATE_LEAD");
      transaction.set(leadRef, lead);
    });
    form.reset();
    showValidation({});
    formFeedback.textContent = `Lead created and routed to ${dealer.name}.`;
  } catch (error) {
    if (error.message === "DUPLICATE_LEAD") {
      formFeedback.textContent = "A lead with this mobile number already exists.";
    } else if (error.code === "permission-denied") {
      formFeedback.textContent = "Your account does not have permission to create leads. Check the Firestore rules.";
    } else {
      console.error("Could not create lead:", error);
      formFeedback.textContent = "The lead could not be saved. Check your connection and Firebase configuration, then try again.";
    }
    formFeedback.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Create lead <span aria-hidden="true">â†’</span>';
  }
});

const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => value && !value.startsWith("YOUR_"));
if (!hasFirebaseConfig) {
  showAuthNotice("Firebase Web app settings are missing. Configure the client settings in public/app.js.");
  authEmail.disabled = true;
  authPassword.disabled = true;
  setAuthBusy(true);
  submitButton.disabled = true;
} else {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          if (unsubscribeLeads) {
            unsubscribeLeads();
            unsubscribeLeads = undefined;
          }
          if (unsubscribeDealers) {
            unsubscribeDealers();
            unsubscribeDealers = undefined;
          }
          dealers = FALLBACK_DEALERS;
          appShell.hidden = true;
          authScreen.hidden = false;
          signedInUser.textContent = "Sales workspace";
          userAvatar.textContent = "U";
          return;
        }

        authScreen.hidden = true;
        appShell.hidden = false;
        signedInUser.textContent = user.displayName || user.email || "Signed in";
        userAvatar.textContent = (user.displayName || user.email || "U")
          .split(/\s+/)
          .map((part) => part[0] || "")
          .join("")
          .slice(0, 2)
          .toUpperCase();
        if (!unsubscribeDealers) watchDealers();
        if (!unsubscribeLeads) watchLeads();
      },
      (error) => {
        console.error("Could not restore Firebase sign-in:", error);
        appShell.hidden = true;
        authScreen.hidden = false;
        showAuthNotice("Could not verify your sign-in. Check Firebase Authentication settings and try again.");
      }
    );
  } catch (error) {
    console.error("Could not initialize Firebase:", error);
    showAuthNotice("Firebase could not be initialized. Check the Web app settings in public/app.js.");
    setAuthBusy(true);
  }
}
