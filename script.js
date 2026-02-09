console.log("profile button:", document.getElementById("profile-btn"));
console.log("canvas:", document.getElementById("radar-chart"));

const MVP_PASSWORD = "eduardo182"; // change later
let rubricLocked = loadRubricLocks();
let teacherMode = false;
let currentMap = "map1";
let completedQuests = loadQuestData();
let questGrades = loadQuestGrades() || {};
let gradingEnabled = false;
let currentQuestId = null;
let scale = 1;
let quests = {}; // store all quests
let questTimers = {}; // Store active timers
let questStartTimes = loadQuestStartTimes(); // Load saved start times
let questAccepted = loadQuestAccepted(); // Track which quests have been accepted
let questRewards = loadQuestRewards() || {}; // Reward system
let deductedRewards = loadDeductedRewards(); // Track total deductions


// ==========================
// STUDENT PROFILE SAVE/LOAD
// ==========================
function saveStudentProfile(profile) {
  localStorage.setItem("studentProfile", JSON.stringify(profile));
}

function loadStudentProfile() {
  const data = localStorage.getItem("studentProfile");
  return data ? JSON.parse(data) : null;
}

function updateProfileUI() {
  const profile = loadStudentProfile();
  if (!profile) return;

  const avatar = document.getElementById("student-avatar");
  const name = document.getElementById("student-name");
  const profileBtn = document.querySelector(".profile-btn"); 

    const profileBtnImg = profileBtn ? profileBtn.querySelector("img") : null;

  if (avatar) avatar.src = profile.character;
  if (name) name.innerText = profile.name;

    if (profileBtnImg) {
    profileBtnImg.src = profile.character;
  }
}

// ==========================
// MAP CONFIG
// ==========================
const MAPS = {
  map1: { image: "map.jpg" },
  map2: { image: "map2.jpg" },
  map3: { image: "map3.jpg" }};

 // ==========================
// MAP LOADING & POSITIONING
// ==========================
function initializeMap() {
  const mapImage = document.getElementById('map-image');
  const hotspots = document.querySelectorAll('.hotspot');
  const container = document.getElementById('map-container');
  
  if (!mapImage || !container) return;
  
  // Initially hide all hotspots
  hotspots.forEach(hotspot => {
    hotspot.style.opacity = '0';
    hotspot.style.pointerEvents = 'none';
  });
  
  // Function to position hotspots
  function positionHotspots() {
    // Get the actual rendered size of the image
    const imgRect = mapImage.getBoundingClientRect();
    
    // Update container dimensions to match image exactly
    container.style.width = imgRect.width + 'px';
    container.style.height = imgRect.height + 'px';
    
    // Show and enable hotspots
    hotspots.forEach(hotspot => {
      hotspot.style.opacity = '1';
      hotspot.style.pointerEvents = 'auto';
    });
    
    console.log('Map initialized. Image size:', imgRect.width, 'x', imgRect.height);
  }
  
  // Check if image is already loaded
  if (mapImage.complete && mapImage.naturalHeight !== 0) {
    positionHotspots();
  } else {
    // Wait for image to load
    mapImage.addEventListener('load', positionHotspots);
  }
  
  // Also reposition on window resize (with debounce)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(positionHotspots, 250);
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeMap);

// Also run on full page load as backup
window.addEventListener('load', () => {
  // Small delay to ensure everything is rendered
  setTimeout(initializeMap, 100);
});

function getMapForQuest(questId) {
  const hotspot = document.querySelector(`.hotspot[data-city="${questId}"]`);
  return hotspot ? hotspot.dataset.map : null;
}

// ==========================
// Summative by path menu
// ==========================
const pathQuests = {
  paintersPath: [
    { title: "Trial of the Modern Masters", id: "quest4", style: "mvp" },
    { title: "Duel of the Silent Master", id: "quest11", style: "mvp" },
    { title: "The Beast of the Borderlands", id: "quest35", style: "mvp" },
    { title: "Chaos Sealed in Color", id: "quest36", style: "mvp" },
    { title: "Bastions of Light and Stone", id: "quest66", style: "mvp" },
   
  ],
  sketcherPath: [
    { title: "The Threat of the East", id: "quest30", style: "mvp" },
    { title: "The Master's Table", id: "quest41", style: "mvp" },
  ],
  watercoloursPath: [
    { title: "The Silent Objects Trial", id: "quest16", style: "mvp" },
    { title: "Chronicle of Living Stone", id: "quest25", style: "mvp" },
    { title: "The Elven Vista Trial", id: "quest17", style: "mvp" },
    { title: "Trial of the Silent Objects", id: "quest22", style: "mvp" },
    { title: "Legacy of Azure and Verdant Peaks", id: "quest50", style: "mvp" },

    { title: "Duel with Loki, The Trickster", id: "quest27", style: "mvp" },
  ],
  "3DPath": [
    { title: "The face stealer", id: "quest53", style: "mvp" },
    { title: "The Necklace of the Desert Moon", id: "quest54", style: "mvp" },
    { title: "The Story Tile of the Hearth", id: "quest56", style: "mvp" },
    { title: "The Bound Spirit", id: "quest57", style: "mvp" },
    { title: "The Citadel of Forms", id: "quest58", style: "mvp" },
    { title: "The Master Forgemaster’s Covenant", id: "quest68", style: "mvp" },
  ]
};

// ==========================
// LOAD QUESTS JSON & BIND HOTSPOTS
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  updateProfileUI();
   recalculateAllQuestRewards();

  const container = document.getElementById("map-container");

  fetch("quests.json")
    .then(res => res.json())
    .then(data => {
      quests = data;
      console.log("Quests loaded:", quests);

      bindHotspots();
      ensureMVPColumnExists();
      updateProfileStandardsTable();
      renderRadarChart();
      updateProfileUI();
      
      // Initialize timers for accepted quests
      initializeQuestTimers();
       initializeQuestList(); // Initialize quest list functionality
    
    })
    .catch(err => console.error("Failed to load quests.json:", err));

  updateHotspotVisibility();

  const mapSelector = document.getElementById("map-selector");
  mapSelector?.addEventListener("change", () => {
    const mapId = mapSelector.value;
    switchMap(mapId);
  });

  document.getElementById("path-selector")?.addEventListener("change", handlePathChange);
  document.getElementById("mvp-quests")?.addEventListener("change", function() {
    if (this.value) openQuest(this.value);
    this.style.display = "none";
  });

  window.addEventListener("wheel", e => {
    if (!e.ctrlKey) return;

    e.preventDefault();

    const zoomFactor = 0.1;
    const MIN_SCALE = 1;

    scale += e.deltaY < 0 ? zoomFactor : -zoomFactor;

    if (scale < MIN_SCALE) {
      scale = MIN_SCALE;
    }

    if (container) {
      container.style.transform = `scale(${scale})`;
    }
  }, { passive: false });

  function isVisible(el) {
    return el && getComputedStyle(el).display !== "none";
  }

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    const achievementsOverlay = document.getElementById("achievements-overlay");
    const rationaleOverlay = document.getElementById("rationale-overlay");
    const questOverlay = document.getElementById("quest-overlay");
    const rubricOverlay = document.getElementById("rubric-overlay");

    if (isVisible(achievementsOverlay)) {
      achievementsOverlay.style.display = "none";
      return;
    }

    if (isVisible(rationaleOverlay)) {
      rationaleOverlay.style.display = "none";
      return;
    }

    if (isVisible(rubricOverlay)) {
      rubricLocked[currentQuestId] = true;
      saveRubricLocks();
      teacherMode = false;
      // UPDATE REWARD WHEN ESCAPING FROM RUBRIC
      const rewardCoins = calculateQuestRewardCoins(currentQuestId);
      const rewardEl = document.getElementById("quest-reward");
      if (rewardEl) {
        rewardEl.innerHTML = rewardCoins ? `<strong>${rewardCoins} 💰</strong>` : "—";
      }
      updateProfileRewards();
          rubricOverlay.style.display = "none";
          questOverlay.style.display = "block";
          return;
        }

    if (isVisible(questOverlay)) {
      closeQuest();
      return;
    }
  });

  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      document.querySelectorAll(".tab-content").forEach(tc => tc.style.display = "none");
      document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));

      const tabEl = document.getElementById("tab-" + tab);
      if (tabEl) tabEl.style.display = "block";
      button.classList.add("active");
    });
  });

  // ==========================
  // STUDENT SETUP (NAME + CHARACTER)
  // ==========================
  initializeStudentSetup();
});

// ==========================
// BIND HOTSPOTS
// ==========================
function bindHotspots() {
  document.querySelectorAll(".hotspot").forEach(hotspot => {
    const cityId = hotspot.dataset.city;
    if (quests[cityId]?.style === "mvp") {
      hotspot.classList.add("mvp-hotspot");
    }
    hotspot.addEventListener("click", () => {
      if (MAPS[cityId]) {
        switchMap(cityId);
      } else {
        openQuest(cityId);
      }
    });
  });
}

// ==========================
// UPDATE HOTSPOT VISIBILITY
// ==========================
function updateHotspotVisibility() {
  document.querySelectorAll(".hotspot").forEach(h => {
    h.style.display = h.dataset.map === currentMap ? "block" : "none";
  });
}

// ==========================
// SWITCH MAP
// ==========================
function switchMap(mapId) {
  if (!MAPS[mapId]) return;

  currentMap = mapId;
  document.getElementById("map-image").src = MAPS[mapId].image;
  updateHotspotVisibility();
  closeQuest();

  const mapSelector = document.getElementById("map-selector");
  if (mapSelector) mapSelector.value = mapId;
}

// ==========================
// OPEN QUEST
// ==========================
function openQuest(cityId) {
  const mapId = getMapForQuest(cityId);
  if (mapId && mapId !== currentMap) {
    switchMap(mapId);
  }

  const quest = quests[cityId];
  if (!quest) return;

  currentQuestId = cityId;
  const questBox = document.getElementById("quest-box");
  questBox.className = "";
  if (quest.style) questBox.classList.add(quest.style);
  if (completedQuests[cityId]) questBox.classList.add("completed");

  document.getElementById("quest-title").innerText = quest.title || "";

  document.getElementById("quest-rationale").innerHTML =
    `<a href="#" onclick="openRationalePopup('${cityId}')">Rationale</a>`;

  document.getElementById("quest-text").innerText = quest.description || "";
  document.getElementById("quest-character").src = quest.character || "";

  document.getElementById("quest-rubric").innerHTML =
    `<a href="#" onclick="openRubricPopup('${cityId}')">Rubric</a>`;
//==========================reward================================================
 const rewardCoins = calculateQuestRewardCoins(cityId);
  questRewards[cityId] = rewardCoins; // Store calculated reward
  document.getElementById("quest-reward").innerHTML =
    rewardCoins ? `<strong>${rewardCoins} 💰</strong>` : "—";

  // Also update profile rewards when quest is opened
  updateProfileRewards();
  //=================================================================================
  const pathContainer = document.getElementById("quest-paths");
  if (pathContainer) {
    pathContainer.innerHTML = Array.isArray(quest.path) && quest.path.length ? quest.path.join(", ") : "No path assigned";
  }

  const prereqContainer = document.getElementById("quest-prereq-leads-prereq");
  if (prereqContainer) {
    prereqContainer.innerHTML = quest.prerequisites && quest.prerequisites.length
      ? quest.prerequisites.map(id => {
          const completed = completedQuests[id] ? '<span class="prereq-check"> ✔</span>' : '';
          return `<li><a href="#" onclick="openQuest('${id}')">${quests[id].title}</a>${completed}</li>`;
        }).join('')
      : "<li>None</li>";
  }

  // Setup timer controls
  setupTimerControls(cityId);

  // Setup completion checkbox
  let questCheck = document.getElementById("quest-check");
  if (questCheck) {
    questCheck.checked = !!completedQuests[cityId];

    const freshCheck = questCheck.cloneNode(true);
    questCheck.parentNode.replaceChild(freshCheck, questCheck);
    questCheck = freshCheck;

    questCheck.addEventListener("change", () => {
      handleQuestCheckChange(cityId, questCheck, questBox);
    });
  }

  const reqBox = document.getElementById("quest-requirements");
  if (reqBox) {
    reqBox.innerHTML = "";
    if (Array.isArray(quest.requirements)) {
      const ul = document.createElement("ul");
      quest.requirements.forEach(r => { const li = document.createElement("li"); li.textContent = r; ul.appendChild(li); });
      reqBox.appendChild(ul);
    }
  }

  const linksEl = document.getElementById("quest-links");
  if (linksEl) {
    linksEl.innerHTML = Array.isArray(quest.links)
      ? quest.links.map((l,i) => `<li><a href="${l.url || '#'}" target="_blank">${l.type || 'Sample'} ${i+1}</a></li>`).join("")
      : "";
  }

  const starsContainer = document.querySelector("#quest-box .difficulty .stars");
  if (starsContainer) {
    starsContainer.innerHTML = "";
    const difficulty = quest.difficulty || 0;
    for (let i = 1; i <= 3; i++) {
      const star = document.createElement("span");
      star.className = i <= difficulty ? "star solid" : "star outline";
      star.innerText = "★";
      starsContainer.appendChild(star);
    }
  }

  const leadsContainer = document.getElementById("quest-prereq-leads-to");
  if (leadsContainer) {
    const leads = Object.entries(quests)
      .filter(([id, q]) => q.prerequisites && q.prerequisites.includes(cityId));

    if (leads.length > 0) {
      leadsContainer.innerHTML = leads.map(([id, quest]) => {
        const completed = completedQuests[id] ? '<span class="prereq-check"> ✔</span>' : '';
        return `<li><a href="#" onclick="openQuest('${id}')">${quest.title}</a>${completed}</li>`;
      }).join('');
    } else {
      leadsContainer.innerHTML = "<li>None</li>";
    }
  }

  document.getElementById("quest-overlay").style.display = "block";
}

function handleQuestCheckChange(cityId, questCheck, questBox) {
  if (!questCheck.checked) {
    completedQuests[currentQuestId] = false;
    questBox.classList.remove("completed");

    // REMOVE GRADES WHEN UNCHECKED
    if (questGrades[currentQuestId]) {
      delete questGrades[currentQuestId];
      saveQuestGrades();
    }
    // REMOVE REWARD WHEN UNCHECKED
    if (questRewards[currentQuestId]) {
      delete questRewards[currentQuestId];
      saveQuestRewards();
    }
        // UPDATE REWARD DISPLAY IMMEDIATELY
    const rewardEl = document.getElementById("quest-reward");
    if (rewardEl) {
      rewardEl.innerHTML = "—";
    }
    
    // UPDATE PROFILE TOTAL
    updateProfileRewards();

    saveQuestData();
    return;
  }

  const password = prompt("Enter teacher password:");

  if (password !== MVP_PASSWORD) {
    alert("Incorrect password.");
    questCheck.checked = false;
    completedQuests[currentQuestId] = false;
    saveQuestData();
    return;
  }

  // ✅ teacher can grade
  teacherMode = true;

  // Unlock rubric so teacher can edit
  rubricLocked[currentQuestId] = false;
  saveRubricLocks();

  // Mark quest completed
  completedQuests[currentQuestId] = true;
  gradingEnabled = true;
  questBox.classList.add("completed");

 // Force remove timer styling when teacher completes it
  questBox.classList.remove("times-up", "warning");
  
  // Also update timer display if it exists
  const timerDisplay = document.getElementById("timer-display");
  if (timerDisplay) {
    timerDisplay.textContent = "Completed";
  }
  
  saveQuestData();

  saveQuestData();

  // Stop timer if quest was accepted
  if (questAccepted[cityId]) {
    stopQuestTimer(cityId);
    questAccepted[cityId] = false;
    saveQuestAccepted();
  }

  // OPEN GRADING POPUP AFTER COMPLETION
  openRubricPopup(currentQuestId);
}

function saveRubricLocks() {
  localStorage.setItem("rubricLocked", JSON.stringify(rubricLocked));
}

function loadRubricLocks() {
  const data = localStorage.getItem("rubricLocked");
  return data ? JSON.parse(data) : {};
}

// ==========================
// SAVE / LOAD QUEST DATA
// ==========================
function saveQuestData() { localStorage.setItem("completedQuests", JSON.stringify(completedQuests)); }
function loadQuestData() { const saved = localStorage.getItem("completedQuests"); return saved ? JSON.parse(saved) : {}; }

// ==========================
// CLOSE QUEST
// ==========================
function closeQuest() {
  // Stop any active timer for the current quest
  if (currentQuestId && questTimers[currentQuestId]) {
    stopQuestTimer(currentQuestId);
  }
  
  document.getElementById("quest-overlay").style.display = "none";
  const pathSel = document.getElementById("path-selector");
  const mvpSel = document.getElementById("mvp-quests");
  if (pathSel) pathSel.value = "";
  if (mvpSel) {
    mvpSel.style.display = "none";
    mvpSel.innerHTML = '<option value="">Select MVP Quest</option>';
  }
}

// ==========================
// STUDENT SETUP LOGIC
// ==========================
let characters = [];

function initializeStudentSetup() {
  const profile = loadStudentProfile();

  // If profile exists, skip setup and welcome
  if (profile && profile.name) {
    updateProfileUI();
    return;
  }

  // show welcome overlay first
  showWelcomeOverlay();
}

function showWelcomeOverlay() {
  const welcomeOverlay = document.getElementById("welcome-overlay");
  if (welcomeOverlay) {
    welcomeOverlay.style.display = "flex";
    
    // Add event listener for the Enter button
    const welcomeCloseBtn = document.getElementById("welcome-close");
    if (welcomeCloseBtn) {
      welcomeCloseBtn.addEventListener("click", () => {
        welcomeOverlay.style.display = "none";
        showCharacterSetup(); // This exists and handles the setup
      });
    }
  }
}

function showStudentSetupOverlay() {
  const overlay = document.getElementById("student-setup-overlay");
  const submitBtn = document.getElementById("student-name-submit");
  const nameInput = document.getElementById("student-name-input");
  const characterDiv = document.getElementById("character-selection");
  const charactersList = document.getElementById("characters-list");

  if (!overlay || !submitBtn || !nameInput || !characterDiv || !charactersList) return;

  overlay.style.display = "flex";

  submitBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) return alert("Please enter your name.");

    const profile = {
      name,
      character: "profile.png"
    };

    saveStudentProfile(profile);
    updateProfileUI();

    nameInput.disabled = true;
    submitBtn.style.display = "none";

    characterDiv.style.display = "block";
    loadCharacterSelectionForProfile(charactersList);
  });

  // load characters
  fetch("characters/characters.json")
    .then(res => res.json())
    .then(data => {
      characters = data.characters || [];

      charactersList.innerHTML = "";
      characters.forEach(char => {
        const card = document.createElement("div");
        card.className = "character-card";
        card.innerHTML = `
          <img src="${char.image}" alt="${char.name}" />
          <div class="character-name">${char.name}</div>
        `;
        card.addEventListener("click", () => {
          selectCharacter(char);
        });
        charactersList.appendChild(card);
      });
    });

  submitBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      alert("Please enter your name.");
      return;
    }

    // lock name
    nameInput.disabled = true;
    submitBtn.disabled = true;

    characterDiv.style.display = "block";
  });
}

function selectCharacter(character) {
  const profile = {
    name: document.getElementById("student-name-input").value.trim(),
    character: character.image
  };

  saveStudentProfile(profile);
  updateProfileUI();

  document.getElementById("student-setup-overlay").style.display = "none";
}

// ==========================
// PATH DROPDOWN HANDLER
// ==========================
function handlePathChange() {
  const path = this.value;
  const mvpSelector = document.getElementById("mvp-quests");
  if (!mvpSelector) return;

  if (path && pathQuests[path]) {
    mvpSelector.style.display = "inline";
    mvpSelector.innerHTML = '<option value="">Select MVP Quest</option>';

    const mvpQuests = pathQuests[path].filter(q => q.style === "mvp");
    if (mvpQuests.length) {
      mvpQuests.forEach(q => {
        const opt = document.createElement("option");
        opt.value = q.id;
        opt.textContent = q.title;
        mvpSelector.appendChild(opt);
      });
    } else {
      mvpSelector.innerHTML += '<option value="">No MVP quests available</option>';
    }
  } else {
    mvpSelector.style.display = "none";
  }
}

// ==========================
// Search engine - fuzzy
// ==========================
const searchInput = document.getElementById("quest-search");
const searchResults = document.getElementById("quest-search-results");

searchInput.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";

  if (term.length < 2) return;

  const matches = fuzzySearchQuests(term);

  if (!matches.length) {
    searchResults.innerHTML = `<div class="search-result">No results</div>`;
    return;
  }

  matches.forEach(({ id, quest }) => {
    const div = document.createElement("div");
    div.className = "search-result";

    const paths = Array.isArray(quest.path)
      ? quest.path.join(", ")
      : quest.path || "No path";

    div.innerHTML = `
      <strong>${paths}</strong><br>
      <span>${quest.title}</span>
    `;

    div.onclick = () => {
      const mapId = getMapForQuest(id);

      if (mapId && mapId !== currentMap) {
        switchMap(mapId);
      }

      scale = 1;
      document.getElementById("map-viewport")?.style && (document.getElementById("map-viewport").style.transform = "scale(1)");

      openQuest(id);

      searchResults.innerHTML = "";
      searchInput.value = "";
    };

    searchResults.appendChild(div);
  });
});

function fuzzySearchQuests(term) {
  const words = term.split(/\s+/);

  return Object.entries(quests)
    .map(([id, quest]) => {
      const haystack = [
        quest.title,
        quest.description,
        ...(quest.requirements || []),
        ...(quest.path || [])
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;

      words.forEach(word => {
        if (haystack.includes(word)) score++;
      });

      return score > 0 ? { id, quest, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

// ==========================
// RATIONALE POPUP LOGIC
// ==========================
function openRationalePopup(questId) {
  const quest = quests[questId];
  if (!quest || !quest.rationale) return;

  document.getElementById("rationale-content").innerHTML =
    quest.rationale;

  playUnrollSound();
  document.getElementById("rationale-overlay").style.display = "flex";
}

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("rationale-overlay");
  const closeBtn = document.getElementById("rationale-close");

  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener("click", () => {
    overlay.style.display = "none";
  });

  overlay.addEventListener("click", e => {
    if (e.target === overlay) {
      overlay.style.display = "none";
    }
  });

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      overlay.style.display = "none";
    }
  });
});

function playUnrollSound() {
  const audio = document.getElementById("unroll-sound");
  if (!audio) return;

  audio.currentTime = 0;
  audio.volume = 0.25;
  audio.play();
}

// =========================
// ACHIEVEMENTS LIST
// =========================
const achievementsData = [
  {
    title: "The Master of Perspective",
    note: "Complete all perspective quests",
    questsNeeded: ["quest42","quest43","quest44","quest45","quest46", "quest47"]
  },
  {
    title: "The Master of touch",
    note: "Complete quests that teach how to create different textures",
    questsNeeded: ["quest7","quest8","quest9","quest10","quest19","quest34","quest35", "quest64", "quest55"]
  },
  {
    title: "The master of the East",
    note: "Complete all quests related to China\nPS: For 'The Story Tile of the Heart` use a chinese theme for the tile.",
    questsNeeded: ["quest56","quest49","quest50"]
  },
  {
    title: "The Facemaster",
    note:"Complete all quests related to portrature (non mvp)",
    questsNeeded: ["quest18","quest20", "quest21","quest29","quest26","quest27","quest53"], 
  },
  {
    title: "That who understand the principles",
    note: "Complete all quest related to the Principles of Design",
    questsNeeded: ["quest59","quest60","quest61","quest62","quest63"]
  },
    {
    title: "The Nature Chronicler",
    note: "Complete all landscape and natural subject quests.",
    questsNeeded: ["quest10","quest17","quest24","quest23","quest65"]
  },
    {
    title: "The Abstract Visionary",
    note: "Explore non-representational and pattern-based art across paths.",
    questsNeeded: ["quest12","quest13","quest14","quest15","quest36"]
  },
    {
    title: "The Traditionalist",
    note: "Complete all quests rooted in classical or cultural art traditions.",
    questsNeeded: ["quest49","quest50","quest54","quest67",]
  },
    {
    title: "The Archtectural Scholar",
    note: "Excel in architectural drawing, perspective, and structure.",
    questsNeeded: ["quest42", "quest43", "quest44", "quest25", "quest58", "quest66"]
  },
    {
    title: "The Seasonal Storyteller",
    note: "Create art inspired by holidays and seasonal themes.",
    questsNeeded: ["quest51", "quest52"]
  },
    {
    title: "The Still Life Connoisseur",
    note: "Excel at observing and rendering still life across mediums.",
    questsNeeded: ["quest5", "quest16", "quest22", "quest41"]
  },
    {
    title: "The Light & Shadow Adept",
    note: "Master the use of value, light, and shadow across media.",
    questsNeeded: ["quest5", "quest8", "quest9", "quest33", "quest64"]
  },
    {
    title: "The Acrylic Master",
    note: "Complete all quests that specifically cite 'acrylic painting'",
    questsNeeded: ["quest1", "quest4", "quest5", "quest6", "quest10", "quest11", "quest19", "quest33", "quest34", "quest35", "quest36", "quest37", "quest66"]
  },
    {
    title: "The Water Sage",
    note: "Complete all watercolor-specific quests.",
    questsNeeded: ["quest32", "quest22", "quest23", "quest24", "quest25", "quest26", "quest27", "quest49", "quest50", "quest65"]
  },
    {
    title: "The 3D Master",
    note: "Complete all 3D quests",
    questsNeeded: ["quest53", "quest54", "quest56", "quest57", "quest58", "quest59", "quest60", "quest61", "quest62", "quest63", "quest68"]
    },  
    {
    title: "The Sketch Master",
    note: "Complete all quests that specifically require pencil, ink or charcoal drawing\nPS:for this achievement, the quest 'Trial of Textured Cubes' need to be done pencil, charcoal or ink",
    questsNeeded: ["quest53", "quest54", "quest56", "quest57", "quest58", "quest59", "quest60", "quest61", "quest62", "quest63", "quest68"]
    },
    {
    title: "The MVP Conquistador",
    note: "Complete all high-difficulty summative quests.",
    questsNeeded: ["quest4","quest11","quest16","quest27", "quest35", "quest36", "quest50", "quest66"]
  },


];

document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("achievements-btn").addEventListener("click", () => {

    const rationaleOverlay = document.getElementById("rationale-overlay");
    if (rationaleOverlay && rationaleOverlay.style.display === "flex") {
      rationaleOverlay.style.display = "none";
    }

    const questOverlay = document.getElementById("quest-overlay");
    if (questOverlay && questOverlay.style.display === "block") {
      closeQuest();
    }

    document.getElementById("achievements-overlay").style.display = "flex";
    renderCompletedQuests();
    renderAchievementsList();
  });

  document.getElementById("close-achievements").addEventListener("click", () => {
    document.getElementById("achievements-overlay").style.display = "none";
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const overlay = document.getElementById("achievements-overlay");
      if (overlay && overlay.style.display === "flex") {
        overlay.style.display = "none";
      }
    }
  });

  document.querySelectorAll(".achievements-tabs .tab-button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none");
      document.getElementById("tab-" + btn.dataset.tab).style.display = "block";

      if (btn.dataset.tab === "questlist") {
      renderQuestList(document.getElementById("questlist-filter").value);
      }
    });
  });

});

function renderCompletedQuests() {
  const grid = document.getElementById("completed-quests-grid");
  grid.innerHTML = "";

  const paths = {};

  for (const [id, quest] of Object.entries(quests)) {
    if (!quest || !completedQuests[id]) continue;

    const questPaths = Array.isArray(quest.path) ? quest.path : [quest.path];

    questPaths.forEach(p => {
      if (!paths[p]) paths[p] = [];
      paths[p].push({ id, title: quest.title });
    });
  }

  for (const [path, list] of Object.entries(paths)) {
    if (list.length === 0) continue;

    const col = document.createElement("div");
    col.innerHTML = `<h3>${path}</h3>`;
    list.forEach(q => {
      const link = document.createElement("a");
      link.href = "#";
      link.innerText = q.title;
      link.addEventListener("click", () => {
        document.getElementById("achievements-overlay").style.display = "none";
        openQuest(q.id);
      });
      col.appendChild(link);
      col.appendChild(document.createElement("br"));
    });
    grid.appendChild(col);
  }
}

function renderAchievementsList() {
  const container = document.getElementById("achievements-list");
  container.innerHTML = "";

  achievementsData.forEach(item => {
    const completedCount = item.questsNeeded.filter(qid => completedQuests[qid]).length;
    const totalCount = item.questsNeeded.length;

    const div = document.createElement("div");
    div.classList.add("achievement-item");

    const header = document.createElement("div");
    header.classList.add("achievement-header");

    const expandBtn = document.createElement("button");
    expandBtn.classList.add("achievement-expand");
    expandBtn.innerText = "+";

    const title = document.createElement("h3");
    title.innerHTML = `
      ${item.title}
      <span class="achievement-progress">(${completedCount}/${totalCount})</span>
    `;

    header.appendChild(title);
    header.appendChild(expandBtn);
    div.appendChild(header);

    if (item.note) {
      const note = document.createElement("div");
      note.classList.add("achievement-note");
      note.innerText = item.note;
      div.appendChild(note);
    }

    const list = document.createElement("ul");
    list.classList.add("achievement-quests");

    item.questsNeeded.forEach(qid => {
      const completed = completedQuests[qid];

      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";
      link.innerText = quests[qid]?.title || qid;

      if (completed) {
        link.innerHTML += " <span class='ach-check'>✓</span>";
      }

      link.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("achievements-overlay").style.display = "none";
        openQuest(qid);
      });

      li.appendChild(link);
      list.appendChild(li);
    });

    div.appendChild(list);
    container.appendChild(div);

    expandBtn.addEventListener("click", () => {
      div.classList.toggle("expanded");
      expandBtn.innerText = div.classList.contains("expanded") ? "−" : "+";
    });
  });
}

// ==========================
// RUBRIC POPUP + GRADING
// ==========================
function openRubricPopup(cityId) {
  const overlay = document.getElementById("rubric-overlay");
  const content = document.getElementById("rubric-content");
  const title = document.getElementById("rubric-title");

  document.getElementById("quest-overlay").style.display = "none";

  const quest = quests[cityId];
  if (!quest || !quest.rubric) return;

  currentQuestId = cityId;

  // If undefined, treat as locked
  const isLocked = rubricLocked[cityId] !== false;

  title.textContent = quest.rubric.overall || quest.title;

  const column = quest.style === "mvp" ? "mvpGrade" : "grade";

  let html = `<table class="rubric-table">
    <thead>
      <tr>
        <th>Standard</th>
        <th>Grade 4</th>
        <th>Grade 3</th>
        <th>Grade 2</th>
        <th>Grade 1</th>
        <th>Your Grade</th>
      </tr>
    </thead>
    <tbody>`;

  quest.rubric.standards.forEach(std => {
    const saved = questGrades[cityId]?.[column]?.[std.code] ?? "";

    const highlightGrade = saved !== "" ? Math.floor(saved) : null;

    html += `<tr>
      <td>${std.code}</td>
      <td class="${highlightGrade === 4 ? "highlight" : ""}">${std.levels["4"] || ""}</td>
      <td class="${highlightGrade === 3 ? "highlight" : ""}">${std.levels["3"] || ""}</td>
      <td class="${highlightGrade === 2 ? "highlight" : ""}">${std.levels["2"] || ""}</td>
      <td class="${highlightGrade === 1 ? "highlight" : ""}">${std.levels["1"] || ""}</td>
      <td>
        <select class="grade-select" data-standard="${std.code}" ${isLocked ? "disabled" : ""}>
          <option value="">—</option>
          <option value="1"${saved === 1 ? " selected" : ""}>1</option>
          <option value="1.5"${saved === 1.5 ? " selected" : ""}>1.5</option>
          <option value="2"${saved === 2 ? " selected" : ""}>2</option>
          <option value="2.5"${saved === 2.5 ? " selected" : ""}>2.5</option>
          <option value="3"${saved === 3 ? " selected" : ""}>3</option>
          <option value="3.5"${saved === 3.5 ? " selected" : ""}>3.5</option>
          <option value="4"${saved === 4 ? " selected" : ""}>4</option>
        </select>
      </td>
    </tr>`;
  });

  html += `</tbody></table>`;

  html += `
    <div id="rubric-lock-controls">
      <button id="unlock-rubric" ${isLocked ? "" : "style='display:none'"}>Unlock for Editing</button>
      <span id="rubric-lock-status">${isLocked ? "Locked (students can view)" : "Unlocked (editing enabled)"}</span>
    </div>
  `;

  content.innerHTML = html;
  overlay.style.display = "flex";

  const unlockBtn = document.getElementById("unlock-rubric");
  const closeBtn = document.getElementById("close-rubric");

  unlockBtn.addEventListener("click", () => {
    const password = prompt("Enter teacher password:");

    if (password === MVP_PASSWORD) {
      rubricLocked[cityId] = false;
      saveRubricLocks();

      document.querySelectorAll(".grade-select").forEach(s => s.disabled = false);
      unlockBtn.style.display = "none";
      document.getElementById("rubric-lock-status").innerText = "Unlocked (editing enabled)";
    } else {
      alert("Incorrect password.");
    }
  });

  closeBtn.addEventListener("click", () => {
    rubricLocked[cityId] = true;
    saveRubricLocks();

    // Refresh the quest reward before showing quest popup
    const rewardCoins = calculateQuestRewardCoins(cityId);
    questRewards[cityId] = rewardCoins;
    saveQuestRewards();
    
    // Update the quest reward display
    const rewardEl = document.getElementById("quest-reward");
    if (rewardEl) {
      rewardEl.innerHTML = rewardCoins ? `<strong>${rewardCoins} 💰</strong>` : "—";
    }
    
    // Update profile total
    updateProfileRewards();
    //===============================================================================
    overlay.style.display = "none";
    document.getElementById("quest-overlay").style.display = "flex";
  });

  document.querySelectorAll(".grade-select").forEach(select => {
    select.addEventListener("change", () => {
      const standardCode = select.dataset.standard;
      const value = parseFloat(select.value);

      if (!questGrades[cityId]) questGrades[cityId] = { grade: {}, mvpGrade: {} };

      if (!questGrades[cityId][column]) {
        questGrades[cityId][column] = {};
      }

      if (isNaN(value)) {
        questGrades[cityId][column][standardCode] = null;
      } else {
        questGrades[cityId][column][standardCode] = value;
      }

      saveQuestGrades();
      ensureMVPColumnExists();
      updateProfileStandardsTable();
      renderRadarChart();
      updateProfileRewards();
    });

    //============================== REWARD SYSTEM =========================================
    // Recalculate quest reward
const coins = calculateQuestRewardCoins(cityId);
questRewards[cityId] = coins;
saveQuestRewards();

// Update quest reward UI if quest is open
const rewardEl = document.getElementById("quest-reward");
if (rewardEl) {
  rewardEl.innerText = coins ? `${coins} 💰` : "";
}

updateProfileRewards();
  });
}

// ==========================
// DEDUCT REWARDS SYSTEM
// ==========================

// Load deducted rewards from localStorage
function loadDeductedRewards() {
    const data = localStorage.getItem("deductedRewards");
    return data ? parseInt(data) : 0;
}

// Save deducted rewards to localStorage
function saveDeductedRewards() {
    localStorage.setItem("deductedRewards", deductedRewards.toString());
}

// Calculate net rewards (total earned minus deductions)
function calculateNetRewards() {
    let totalEarned = 0;
    
    // Calculate from all completed quests
    Object.entries(completedQuests).forEach(([qid, isCompleted]) => {
        if (isCompleted) {
            const coins = calculateQuestRewardCoins(qid);
            totalEarned += coins;
        }
    });
    
    return Math.max(0, totalEarned - deductedRewards);
}

// Update profile rewards display with net amount
function updateProfileRewards() {
    const netRewards = calculateNetRewards();
    
    console.log("=== DEBUG: updateProfileRewards() called ===");
    console.log("Total earned:", getTotalEarnedRewards());
    console.log("Deducted:", deductedRewards);
    console.log("Net rewards:", netRewards);
    
    // UPDATE THE SPAN ELEMENT
    const el = document.getElementById("profile-total-coins");
    if (el) {
        console.log("Found #profile-total-coins element, updating with net rewards...");
        el.innerText = `${netRewards} 💰`;
        console.log("Updated element with:", el.innerText);
    } else {
        console.error("ERROR: Could not find #profile-total-coins element!");
    }
}

// Helper function to get total earned (before deductions)
function getTotalEarnedRewards() {
    let total = 0;
    Object.entries(completedQuests).forEach(([qid, isCompleted]) => {
        if (isCompleted) {
            const coins = calculateQuestRewardCoins(qid);
            total += coins;
        }
    });
    return total;
}

// Deduct rewards function
function deductRewards() {
    // Ask for teacher password
    const password = prompt("Enter teacher password to deduct rewards:");
    
    if (password !== MVP_PASSWORD) {
        alert("Incorrect password. Only teachers can deduct rewards.");
        return;
    }
    
    // Show current balance and ask for deduction amount
    const currentNet = calculateNetRewards();
    const totalEarned = getTotalEarnedRewards();
    
    if (currentNet <= 0) {
        alert("Student has no rewards to deduct!");
        return;
    }
    
    const deduction = prompt(
        `Current balance: ${currentNet} 💰\n` +
        `Total earned: ${totalEarned} 💰\n` +
        `Already deducted: ${deductedRewards} 💰\n\n` +
        `Enter amount to deduct (max ${currentNet}):`
    );
    
    if (!deduction || isNaN(deduction) || deduction.trim() === "") {
        alert("No deduction amount entered.");
        return;
    }
    
    const deductionAmount = parseInt(deduction);
    
    if (deductionAmount <= 0) {
        alert("Deduction amount must be positive.");
        return;
    }
    
    if (deductionAmount > currentNet) {
        alert(`Cannot deduct ${deductionAmount}. Maximum available: ${currentNet}`);
        return;
    }
    
    // Ask for reason (optional)
    const reason = prompt("Optional: Enter reason for deduction (e.g., 'Purchased art supplies'):") || "No reason provided";
    
    // Confirm deduction
    if (confirm(`Deduct ${deductionAmount} 💰?\n\nReason: ${reason}\n\nNew balance will be: ${currentNet - deductionAmount} 💰`)) {
        // Add to total deductions
        deductedRewards += deductionAmount;
        saveDeductedRewards();
        
        // Force update all UI elements that show rewards
        refreshAllRewardDisplays();

        // Log the deduction (for record keeping)
        logDeduction(deductionAmount, reason);
        
        alert(`✅ ${deductionAmount} 💰 deducted successfully!\nNew balance: ${calculateNetRewards()} 💰`);
    }
}
// NEW FUNCTION: Refresh all reward displays in the UI
function refreshAllRewardDisplays() {
    // Update profile total
    updateProfileRewards();
    
    // If profile overlay is open, ensure it's updated
    const profileOverlay = document.getElementById("profile-overlay");
    if (profileOverlay && profileOverlay.style.display === "flex") {
        // Force a re-render of the profile section
        updateProfileRewards();
    }
    
    // If quest overlay is open, update the reward display there too
    const questOverlay = document.getElementById("quest-overlay");
    if (questOverlay && questOverlay.style.display === "block") {
        // Just update the profile reward display within the quest overlay if it exists
        updateProfileRewards();
    }
    
    console.log("All reward displays refreshed. New net balance:", calculateNetRewards());
}

// Log deductions for record keeping
function logDeduction(amount, reason) {
    const deductionLog = loadDeductionLog();
    const logEntry = {
        date: new Date().toISOString(),
        amount: amount,
        reason: reason,
        teacher: "Teacher", // You could store teacher name if you have multiple
        balanceBefore: calculateNetRewards() + amount, // Before deduction
        balanceAfter: calculateNetRewards() // After deduction
    };
    
    deductionLog.push(logEntry);
    localStorage.setItem("deductionLog", JSON.stringify(deductionLog));
    
    console.log("Deduction logged:", logEntry);
}

// Load deduction log
function loadDeductionLog() {
    const data = localStorage.getItem("deductionLog");
    return data ? JSON.parse(data) : [];
}

// View deduction history (optional feature)
function viewDeductionHistory() {
    const deductionLog = loadDeductionLog();
    
    if (deductionLog.length === 0) {
        alert("No deductions have been made yet.");
        return;
    }
    
    const password = prompt("Enter teacher password to view deduction history:");
    if (password !== MVP_PASSWORD) {
        alert("Incorrect password.");
        return;
    }
    
    let historyText = `=== DEDUCTION HISTORY ===\n\n`;
    deductionLog.forEach((entry, index) => {
        const date = new Date(entry.date).toLocaleString();
        historyText += `#${index + 1}: ${date}\n`;
        historyText += `Amount: -${entry.amount} 💰\n`;
        historyText += `Reason: ${entry.reason}\n`;
        historyText += `Balance before: ${entry.balanceBefore} 💰\n`;
        historyText += `Balance after: ${entry.balanceAfter} 💰\n`;
        historyText += `\n`;
    });
    
    historyText += `\nTotal deducted: ${deductedRewards} 💰`;
    historyText += `\nCurrent net balance: ${calculateNetRewards()} 💰`;
    
    alert(historyText);
}

// Initialize deduction system
function initializeDeductionSystem() {
    // Add event listener to the deduct button
    const deductBtn = document.getElementById("deduct-rewards-btn");
    if (deductBtn) {
        deductBtn.addEventListener("click", deductRewards);
    }
    
}

// ==========================
// UPDATE EXISTING FUNCTIONS
// ==========================

// Update recalculateAllQuestRewards to consider deductions
function recalculateAllQuestRewards() {
    console.log("=== Recalculating ALL quest rewards ===");
    
    // Clear existing rewards
    questRewards = {};
    
    // Recalculate for all completed quests
    Object.keys(completedQuests).forEach(qid => {
        if (completedQuests[qid]) {
            const coins = calculateQuestRewardCoins(qid);
            questRewards[qid] = coins;
        }
    });
    
    saveQuestRewards();
    refreshAllRewardDisplays();
    console.log("Recalculation complete. Net rewards:", calculateNetRewards());
}

// Update the DOMContentLoaded event listener to initialize the deduction system
document.addEventListener("DOMContentLoaded", () => {
    updateProfileUI();
    recalculateAllQuestRewards();
    
    // ... existing code ...
    
    // Initialize deduction system
    initializeDeductionSystem();
    
    // ... rest of your existing code ...
});

// Also update when profile is opened
document.addEventListener("DOMContentLoaded", () => {
    const profileBtn = document.getElementById("profile-btn");
    const profileOverlay = document.getElementById("profile-overlay");
    const profileClose = document.getElementById("profile-close");

    if (!profileBtn || !profileOverlay || !profileClose) return;

    profileBtn.addEventListener("click", () => {
        // ... existing code ...
        
        profileOverlay.style.display = "flex";
        ensureMVPColumnExists();
        updateProfileStandardsTable();
        renderRadarChart();
        updateProfileUI();
        showAvatarChangeUI();
        updateProfileRewards(); // This now shows net rewards
        
        // ... existing code ...
    });
    
    // ... rest of your existing code ...
});




// ==========================
// PROFILE LOGIC
// ==========================
document.addEventListener("DOMContentLoaded", () => {

  const profileBtn = document.getElementById("profile-btn");
  const profileOverlay = document.getElementById("profile-overlay");
  const profileClose = document.getElementById("profile-close");

  if (!profileBtn || !profileOverlay || !profileClose) return;

  profileBtn.addEventListener("click", () => {
    document.getElementById("change-avatar-btn")?.addEventListener("click", () => {
      // show setup overlay but skip name step
      document.getElementById("student-setup-overlay").style.display = "flex";
      document.getElementById("student-name-input").style.display = "none";
      document.getElementById("student-name-submit").style.display = "none";
      document.getElementById("character-selection").style.display = "block";
      document.getElementById("student-setup-overlay").classList.add("hide-setup-text");

      loadCharacterSelectionForProfile(document.getElementById("characters-list"));
      //=============================================reward=====================================
      updateProfileRewards();
    });

    profileOverlay.style.display = "flex";
    ensureMVPColumnExists();
    updateProfileStandardsTable();
    renderRadarChart();
    updateProfileUI();
    showAvatarChangeUI();
    updateProfileRewards();
  });

  profileClose.addEventListener("click", () => {
    profileOverlay.style.display = "none";
  });

  profileOverlay.addEventListener("click", (e) => {
    if (e.target === profileOverlay) {
      profileOverlay.style.display = "none";
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && profileOverlay.style.display === "flex") {
      profileOverlay.style.display = "none";
    }
  });
});
//=============================================================================================================
//  REWARD SYSTEM
//=============================================================================================================
function saveQuestRewards() {
  localStorage.setItem("questRewards", JSON.stringify(questRewards));
}

function loadQuestRewards() {
  const data = localStorage.getItem("questRewards");
  return data ? JSON.parse(data) : {};
}
// ============================REWARD MATH =================================
function calculateQuestRewardCoins(questId) {
  // Return 0 if quest is not completed
  if (!completedQuests[questId]) {
    console.log(`Quest ${questId} not completed, returning 0`);
    return 0;
  }
  
  const quest = quests[questId];
  if (!quest || !quest.rubric) {
    console.log(`Quest ${questId} has no rubric, returning 0`);
    return 0;
  }

  const column = quest.style === "mvp" ? "mvpGrade" : "grade";
  const grades = questGrades[questId]?.[column];
  
  // If no grades exist yet, return 0 (even if completed)
  if (!grades || Object.keys(grades).length === 0) {
    console.log(`Quest ${questId} has no grades, returning 0`);
    return 0;
  }

  let totalCoins = 0;
  console.log(`Calculating coins for ${questId}:`, grades);

  Object.values(grades).forEach(val => {
    if (typeof val === "number" && !isNaN(val)) {
      // Each grade point is worth 10 coins, sum them up
      totalCoins += Math.round(val * 10);
    }
  });

  console.log(`Quest ${questId} total coins: ${totalCoins}`);
  return totalCoins;
}

// ==========================
// AVATAR CHANGE UI
// ==========================
function showAvatarChangeUI() {
  const profileLeft = document.querySelector(".profile-left");
  if (!profileLeft) return;

  // If already exists, skip
  if (document.getElementById("avatar-change-container")) return;

  const container = document.createElement("div");
  container.id = "avatar-change-container";
  container.style.marginTop = "10px";

  profileLeft.appendChild(container);

  document.getElementById("change-avatar-btn").addEventListener("click", () => {
    const selection = document.getElementById("avatar-selection");
    selection.style.display = selection.style.display === "none" ? "block" : "none";

    if (selection.innerHTML.trim() === "") {
      loadCharacterSelectionForProfile(selection);
    }
  });
}

function loadCharacterSelectionForProfile(container) {
  fetch("characters/characters.json")
    .then(res => res.json())
    .then(characters => {
      container.innerHTML = "";

      characters.forEach(charFile => {
        const img = document.createElement("img");
        img.src = "characters/" + charFile;
        img.classList.add("character-img");
        img.style.cursor = "pointer";

        img.addEventListener("click", () => {
          const profile = loadStudentProfile() || {};
          profile.character = "characters/" + charFile;
          saveStudentProfile(profile);
          updateProfileUI();

          // close overlay
          document.getElementById("student-setup-overlay").style.display = "none";
        });

        container.appendChild(img);
      });
    })
    .catch(err => console.error("Failed to load characters.json:", err));
}

// ==========================
// MVP GRADE LOGIC
// ==========================
function computeStandardAverage(isMVP, standardCode) {
  let sum = 0;
  let count = 0;

  for (const qid in questGrades) {
    const quest = quests[qid];
    if (!quest) continue;

    // Only include completed quests
    if (!completedQuests[qid]) continue;

    // Ensure we are counting only MVP or non-MVP quests
    if (isMVP && quest.style !== "mvp") continue;
    if (!isMVP && quest.style === "mvp") continue;

    const column = isMVP ? "mvpGrade" : "grade";
    const raw = questGrades[qid]?.[column]?.[standardCode];

    if (raw !== null && raw !== undefined && !isNaN(raw)) {
      sum += raw;
      count++;
    }
  }

  return count ? (sum / count) : "";
}

// ==========================
// PROFILE GRADE AVERAGE
// ==========================
function ensureMVPColumnExists() {
  const table = document.getElementById("standards-table");
  if (!table) return;

  const headerRow = table.querySelector("thead tr");
  if (!headerRow) return;

  // If MVP header is missing, add it
  if (!headerRow.querySelector(".mvp-header")) {
    const th = document.createElement("th");
    th.className = "mvp-header";
    th.innerText = "MVP Grade";
    headerRow.appendChild(th);
  }

  // Ensure each row has MVP cell
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach(row => {
    if (!row.querySelector(".mvp-cell")) {
      const td = document.createElement("td");
      td.className = "mvp-cell";
      td.innerText = "";
      row.appendChild(td);
    }
  });
}

function updateProfileStandardsTable() {
  ensureMVPColumnExists();

  const rows = document.querySelectorAll("#standards-table tbody tr");

  rows.forEach(row => {
    const standardCode = row.dataset.standard;

    const gradeAvg = computeStandardAverage(false, standardCode);
    const mvpAvg = computeStandardAverage(true, standardCode);

    row.children[1].innerText = gradeAvg ? gradeAvg.toFixed(2) : "";

    const mvpCell = row.querySelector(".mvp-cell");
    if (mvpCell) {
      mvpCell.innerText = mvpAvg ? mvpAvg.toFixed(2) : "";
    }
  });
}

// ==========================
// RADAR CHART
// ==========================
const radarDescriptions = {
  creating: "Creating: Generating ideas and creating art through experimentation and planning.",
  presenting: "Presenting: Sharing and presenting art with intentional choices and reflection.",
  responding: "Responding: Interpreting and evaluating art using reasoning and evidence.",
  connecting: "Connecting: Making connections between art, culture, and personal experiences."
};

function computeMvpDomainGrades() {
  const mvpStandards = {
    creating: [
      "Art.FA.CR.1.1.IA",
      "Art.FA.CR.1.2.IA",
      "Art.FA.CR.2.1.IA",
      "Art.FA.CR.2.3.IA",
      "Art.FA.CR.3.1.IA"
    ],
    presenting: ["Art.FA.PR.6.1.IA"],
    responding: ["Art.FA.RE.8.1.8A"],
    connecting: ["Art.FA.CN.10.1.IA"]
  };

  const domainGrades = {};

  for (const domain in mvpStandards) {
    let sum = 0;
    let count = 0;

    mvpStandards[domain].forEach(code => {
      const avg = computeStandardAverage(true, code);

      // ✅ ONLY include standards that were actually assessed
      if (typeof avg === "number" && !isNaN(avg)) {
        sum += avg;
        count++;
      }
    });

    domainGrades[domain] = count ? sum / count : 0;
  }

  return domainGrades;
}

function renderRadarChart() {
  const canvas = document.getElementById("radar-chart");
  const tooltip = document.getElementById("radar-tooltip");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const radarData = computeMvpDomainGrades();
  const labels = ["creating", "presenting", "responding", "connecting"];
  const values = labels.map(l => radarData[l]);

  const size = 350;
  canvas.width = size;
  canvas.height = size;

  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = 110;
  const steps = 4;

  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;

  for (let s = 1; s <= steps; s++) {
    ctx.beginPath();
    const r = (maxRadius / steps) * s;
    for (let i = 0; i < labels.length; i++) {
      const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  for (let i = 0; i < labels.length; i++) {
    const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
    const x = centerX + maxRadius * Math.cos(angle);
    const y = centerY + maxRadius * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const labelPositions = [];
  for (let i = 0; i < labels.length; i++) {
    const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
    const x = centerX + (maxRadius + 22) * Math.cos(angle);
    const y = centerY + (maxRadius + 22) * Math.sin(angle);

    ctx.fillText(labels[i].charAt(0).toUpperCase() + labels[i].slice(1), x, y);
    labelPositions.push({ x, y, label: labels[i] });
  }

  // Create hover zones for labels
  const labelZones = labelPositions.map(lp => {
    ctx.font = "bold 14px Arial";
    const text = lp.label.charAt(0).toUpperCase() + lp.label.slice(1);
    const textWidth = ctx.measureText(text).width;

    return {
      label: lp.label,
      x: lp.x,
      y: lp.y,
      width: textWidth,
      height: 16
    };
  });

  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
    const r = (values[i] / 4) * maxRadius;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff";
  const pointPositions = [];
  values.forEach((val, i) => {
    const angle = (Math.PI * 2 / labels.length) * i - Math.PI / 2;
    const r = (val / 4) * maxRadius;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    pointPositions.push({ x, y, label: labels[i] });
  });

  canvas.onmousemove = (e) => {
    const container = document.getElementById("radar-chart-container");
    const rect = container.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let found = false;

    for (const pt of pointPositions) {
      const dist = Math.hypot(mouseX - pt.x, mouseY - pt.y);
      if (dist < 10) {
        tooltip.innerText = radarDescriptions[pt.label];
        tooltip.style.opacity = 1;
        tooltip.style.left = (mouseX + 15) + "px";
        tooltip.style.top = (mouseY - 25) + "px";
        found = true;
        break;
      }
    }

    if (!found) {
      for (const lbl of labelPositions) {
        const dist = Math.hypot(mouseX - lbl.x, mouseY - lbl.y);
        if (dist < 40) {
          tooltip.innerText = radarDescriptions[lbl.label];
          tooltip.style.opacity = 1;
          tooltip.style.left = (mouseX + 15) + "px";
          tooltip.style.top = (mouseY - 25) + "px";
          found = true;
          break;
        }
      }
    }

    if (!found) {
      tooltip.style.opacity = 0;
    }
  };
}

// ==========================
// GRADES STORAGE
// ==========================
function saveQuestGrades() {
  localStorage.setItem("questGrades", JSON.stringify(questGrades));
}

function loadQuestGrades() {
  const data = localStorage.getItem("questGrades");
  return data ? JSON.parse(data) : {};
}

// ==========================
// TIMER FUNCTIONS
// ==========================
function saveQuestStartTimes() {
  localStorage.setItem("questStartTimes", JSON.stringify(questStartTimes));
}

function loadQuestStartTimes() {
  const data = localStorage.getItem("questStartTimes");
  return data ? JSON.parse(data) : {};
}

function saveQuestAccepted() {
  localStorage.setItem("questAccepted", JSON.stringify(questAccepted));
}

function loadQuestAccepted() {
  const data = localStorage.getItem("questAccepted");
  return data ? JSON.parse(data) : {};
}

function formatTime(minutes, showClasses = true) {
  if (showClasses) {
    // Show classes first, then detailed time
    const classes = minutes / 75;
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);
    
    if (classes >= 1) {
      const wholeClasses = Math.floor(classes);
      const remainingMinutes = Math.round((classes - wholeClasses) * 75);
      
      if (wholeClasses > 0 && remainingMinutes > 0) {
        return `${wholeClasses} ${wholeClasses === 1 ? 'class' : 'classes'} ${remainingMinutes}m`;
      } else if (wholeClasses > 0) {
        return `${wholeClasses} ${wholeClasses === 1 ? 'class' : 'classes'}`;
      } else {
        return `${remainingMinutes}m`;
      }
    }
  }
    const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.floor((minutes * 60) % 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

function initializeQuestTimers() {
  // Start timers for all accepted quests
  for (const questId in questAccepted) {
    if (questAccepted[questId] && questStartTimes[questId]) {
      startQuestTimer(questId);
    }
  }
}

function updateTimerDisplay(questId) {
  if (!questStartTimes[questId]) return;
  
  const quest = quests[questId];
  if (!quest || !quest.timer) return;
  
  const startTime = new Date(questStartTimes[questId]);
  const elapsedMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
  const remainingMinutes = Math.max(0, quest.timer.allottedMinutes - elapsedMinutes);
  
  const timerDisplay = document.getElementById("timer-display");
  const questBox = document.getElementById("quest-box");
  
  if (timerDisplay && questBox && currentQuestId === questId) {
    timerDisplay.textContent = formatTime (remainingMinutes, true);
    
    // Update quest box styling based on time remaining
    const warningThreshold = quest.timer.allottedMinutes * 0.3; // 30% of allotted time
    
    if (remainingMinutes <= 0) {
      questBox.classList.add("times-up");
      questBox.classList.remove("warning");
      timerDisplay.textContent = "TIME'S UP!";
    } else if (remainingMinutes <= warningThreshold) {
      questBox.classList.add("warning");
      questBox.classList.remove("times-up");
    } else {
      questBox.classList.remove("warning", "times-up");
    }
  }
    
  // Save updated remaining time for persistence
  return remainingMinutes;
}

function startQuestTimer(questId) {
  // Clear any existing timer for this quest
  if (questTimers[questId]) {
    clearInterval(questTimers[questId]);
  }
  
  // Start new timer
  questTimers[questId] = setInterval(() => {
    const remaining = updateTimerDisplay(questId);
    if (remaining <= 0) {
      stopQuestTimer(questId);
    }
  }, 1000); // Update every second
  
  // Initial update
  updateTimerDisplay(questId);
}

function stopQuestTimer(questId) {
  if (questTimers[questId]) {
    clearInterval(questTimers[questId]);
    delete questTimers[questId];
  }
}

function acceptQuest(questId) {
  const quest = quests[questId];
  if (!quest || !quest.timer) return;

  const minutes = quest.timer.allottedMinutes;                                    //-----------------------
  const classesDisplay = convertMinutesToClasses(minutes);                        //-----------------------
  
  if (confirm(`Accept "${quest.title}"?\n\nYou will have ${quest.timer.allottedMinutes} minutes to complete this quest.`)) {
    // Mark quest as accepted
    questAccepted[questId] = true;
    questStartTimes[questId] = new Date().toISOString();
    
    saveQuestAccepted();
    saveQuestStartTimes();
    
    // Update UI
    const acceptBtn = document.getElementById("quest-accept");
    if (acceptBtn) {
      acceptBtn.disabled = true;
      acceptBtn.textContent = "Accepted";
    }
    
    // Show timer display
    const timerDisplay = document.getElementById("timer-display");
    if (timerDisplay) {
      timerDisplay.style.display = "block";
    }
    
    // Start the timer
    startQuestTimer(questId);
    
    // Save to localStorage
    saveQuestData();
  }
}

function resetQuestTimer(questId) {
  // Clear saved data
  delete questStartTimes[questId];
  delete questAccepted[questId];
  
  saveQuestStartTimes();
  saveQuestAccepted();
  
  // Stop the timer
  stopQuestTimer(questId);
  
  // Reset UI
  const questBox = document.getElementById("quest-box");
  if (questBox && currentQuestId === questId) {
    questBox.classList.remove("warning", "times-up");
  }
  
  const timerDisplay = document.getElementById("timer-display");
  if (timerDisplay && currentQuestId === questId) {
    timerDisplay.textContent = "";
    timerDisplay.style.display = "none";
  }
  
  const acceptBtn = document.getElementById("quest-accept");
  if (acceptBtn && currentQuestId === questId) {
    acceptBtn.disabled = false;
    acceptBtn.textContent = "Accept Quest";
  }
  
  const questCheck = document.getElementById("quest-check");
  if (questCheck && currentQuestId === questId) {
    questCheck.disabled = false;
    questCheck.title = "";
  }
}

function setupTimerControls(questId) {
  const quest = quests[questId];
  const acceptBtn = document.getElementById("quest-accept");
  const timerDisplay = document.getElementById("timer-display");
  
  if (!quest || !acceptBtn || !timerDisplay) return;
  
  // Setup accept button
  if (quest.timer) {
    acceptBtn.style.display = "block";
    
    // Check if quest is already accepted
    if (questAccepted[questId]) {
      acceptBtn.disabled = true;
      acceptBtn.textContent = "Accepted";
      timerDisplay.style.display = "block";
      
      // Start timer if not already running
      if (!questTimers[questId] && questStartTimes[questId]) {
        startQuestTimer(questId);
      }
    } else {
      acceptBtn.disabled = false;
      acceptBtn.textContent = "Accept Quest";
      timerDisplay.style.display = "none";
    }
    
    // Remove any existing event listener
    const newAcceptBtn = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
    
    // Add new event listener
    newAcceptBtn.addEventListener("click", () => {
      if (!questAccepted[questId]) {
        acceptQuest(questId);
      }
    });
  } else {
    // Hide accept button and timer for quests without timer
    acceptBtn.style.display = "none";
    timerDisplay.style.display = "none";
    document.getElementById("quest-box").classList.add("no-timer");
  }
  
  // ALWAYS ensure checkbox is enabled initially
  const questCheck = document.getElementById("quest-check");
  if (questCheck) {
    questCheck.disabled = false; // Ensure checkbox is not disabled by timer
    questCheck.title = "";
  }
}

// ============================================
// JSON PROFILE SAVE/LOAD SYSTEM
// ============================================

// 1. COLLECT ALL STUDENT DATA
function collectStudentData() {
    const studentData = {
        // Basic student info
        name: document.getElementById('student-name')?.textContent || 'Unnamed Artist',
        character: document.getElementById('student-avatar')?.src || 'profile.png',
        timestamp: new Date().toISOString(),
        
        // Your existing completion data
        completedQuests: completedQuests,
        
        // Your existing grading data
        questGrades: questGrades,
        
        // Your existing rubric locks
        rubricLocked: rubricLocked,
        
        // Timer data
        questAccepted: questAccepted,
        questStartTimes: questStartTimes,
        
        // Collect art standards
        standards: {},
        
        // Metadata
        appName: "Artheim",
        version: "1.0",
        exportDate: new Date().toLocaleString()
    };
    
    // Collect art standards from the table
    document.querySelectorAll('#standards-table tbody tr').forEach(row => {
        const standard = row.getAttribute('data-standard');
        const gradeCell = row.children[1];
        const mvpCell = row.querySelector('.mvp-cell');
        
        if (standard) {
            studentData.standards[standard] = {
                regular: gradeCell?.textContent.trim() || '',
                mvp: mvpCell?.textContent.trim() || ''
            };
        }
    });
    
    return studentData;
}

// 2. SAVE PROFILE AS JSON FILE
function saveProfileAsJSON() {
    const studentData = collectStudentData();
    
    // Format JSON nicely
    const jsonString = JSON.stringify(studentData, null, 2);
    
    // Create download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create filename with student name and date
    const studentName = document.getElementById('student-name')?.textContent || 'Student';
    const sanitizedName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const link = document.createElement('a');
    link.download = `Artheim-${sanitizedName}-${dateStr}.json`;
    link.href = url;
    link.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    
    // Show success message
    const completedCount = Object.values(studentData.completedQuests || {}).filter(v => v).length;
    const gradedCount = Object.keys(studentData.questGrades || {}).length;
    
    alert(`✅ Profile saved successfully!\n\nFilename: ${link.download}\nCompleted quests: ${completedCount}\nGraded quests: ${gradedCount}\n\nSave this file to backup your progress.`);
}

// 3. LOAD PROFILE FROM JSON FILE
function loadProfileFromJSON(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const jsonString = e.target.result;
            const studentData = JSON.parse(jsonString);
            
            // Validate the file
            if (!studentData.appName || studentData.appName !== "Artheim") {
                throw new Error('This is not a valid Artheim profile file.');
            }
            
            // Show confirmation with stats
            const completedCount = Object.values(studentData.completedQuests || {}).filter(v => v).length;
            const gradedCount = Object.keys(studentData.questGrades || {}).length;
            
            if (confirm(`Load profile for "${studentData.name}"?\n\nCompleted quests: ${completedCount}\nGraded quests: ${gradedCount}\nExport date: ${studentData.exportDate || 'Unknown'}\n\nThis will OVERRIDE all current progress and grades.`)) {
                loadStudentData(studentData);
            }
            
        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

// 4. LOAD STUDENT DATA INTO THE SYSTEM
function loadStudentData(data) {
    // Load basic student info
    if (data.name) {
        const nameElement = document.getElementById('student-name');
        if (nameElement) nameElement.textContent = data.name;
        localStorage.setItem('studentName', data.name);
    }
    
    if (data.character) {
        const avatar = document.getElementById('student-avatar');
        if (avatar) avatar.src = data.character;
        localStorage.setItem('studentCharacter', data.character);
    }
    
    // Load completed quests
    if (data.completedQuests) {
        // Clear current completions
        for (const key in completedQuests) {
            delete completedQuests[key];
        }
        
        // Load new completions
        Object.assign(completedQuests, data.completedQuests);
        saveQuestData();
    }
    
    // Load quest grades
    if (data.questGrades) {
        // Clear current grades
        for (const key in questGrades) {
            delete questGrades[key];
        }
        
        // Load new grades
        Object.assign(questGrades, data.questGrades);
        saveQuestGrades();
    }
    
    // Load rubric locks
    if (data.rubricLocked) {
        // Clear current locks
        for (const key in rubricLocked) {
            delete rubricLocked[key];
        }
        
        // Load new locks
        Object.assign(rubricLocked, data.rubricLocked);
        saveRubricLocks();
    }
    
    // Load timer data
    if (data.questAccepted) {
        questAccepted = data.questAccepted;
        saveQuestAccepted();
    }
    
    if (data.questStartTimes) {
        questStartTimes = data.questStartTimes;
        saveQuestStartTimes();
    }
    
    // Load art standards into the table
    if (data.standards) {
        Object.entries(data.standards).forEach(([standard, grades]) => {
            const row = document.querySelector(`tr[data-standard="${standard}"]`);
            if (row) {
                const gradeCell = row.children[1];
                const mvpCell = row.querySelector('.mvp-cell');
                
                if (gradeCell && grades.regular) {
                    gradeCell.textContent = grades.regular;
                }
                if (mvpCell && grades.mvp) {
                    mvpCell.textContent = grades.mvp;
                }
            }
        });
    }
    
    // Refresh all displays
    updateProfileStandardsTable();
    renderRadarChart();
    renderCompletedQuests();
    renderAchievementsList();
     recalculateAllQuestRewards();
    
    // Initialize timers for accepted quests
    initializeQuestTimers();
    
    // Show success message
    setTimeout(() => {
        alert(`✅ Profile for "${data.name}" loaded successfully!\n\nYour progress has been restored.`);
        
        // Close profile overlay if open
        const profileOverlay = document.getElementById('profile-overlay');
        if (profileOverlay) profileOverlay.style.display = 'none';
    }, 300);
    updateProfileRewards();
}

// 5. CREATE PROFILE MANAGEMENT UI
function createProfileManagementUI() {
    // Add event listeners
    document.getElementById('save-profile-btn').addEventListener('click', saveProfileAsJSON);
    
    const fileInput = document.getElementById('load-profile-input');
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            loadProfileFromJSON(file);
            fileInput.value = ''; // Clear input
        }
    });
}

// 6. ADD STYLES
function addProfileManagementStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .profile-buttons button:hover {
            background: #A0522D !important;
            transform: scale(1.02);
            transition: all 0.3s;
        }
        
        .profile-buttons label:hover {
            background: #A0522D !important;
            transform: scale(1.02);
            transition: all 0.3s;
        }
        
        .qr-section {
            margin-top: 20px;
            padding: 15px;
            background: rgba(139, 69, 19, 0.1);
            border-radius: 8px;
            border: 1px solid #8B4513;
        }
        
        .qr-section h3 {
            margin-top: 0;
            color: #8B4513;
            text-align: center;
        }
        
        /* You can remove QR scanner overlay styles since we're not using QR */
        #qr-scanner-overlay {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

// 7. INITIALIZE PROFILE MANAGEMENT
function initializeProfileManagement() {
    addProfileManagementStyles();
    
    // Wait a bit for DOM to be ready
    setTimeout(() => {
        createProfileManagementUI();
        console.log('Profile management system initialized');
    }, 500);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeProfileManagement();
});

// Make functions available globally for debugging
window.ArtheimProfile = {
    saveProfileAsJSON,
    loadProfileFromJSON,
    collectStudentData,
    loadStudentData
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const overlay = document.getElementById("student-setup-overlay");
    if (overlay && overlay.style.display === "flex") {
      overlay.style.display = "none";
      overlay.classList.remove("hide-setup-text");
      document.getElementById("student-name-input").style.display = "block";
      document.getElementById("student-name-submit").style.display = "block";
      document.getElementById("character-selection").style.display = "none";
    }
  }
});


                                                                                        // ==========================
// MINUTES TO CLASSES CONVERSION
// ==========================
function convertMinutesToClasses(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) {
    return "0 classes";
  }
  
  const classes = Math.round(minutes / 75);
  
  if (classes === 1) {
    return "1 class";
  } else {
    return `${classes} classes`;
  }
}

// Alternative version with decimal precision if needed:
function convertMinutesToClassesDecimal(minutes, decimalPlaces = 1) {
  if (typeof minutes !== 'number' || isNaN(minutes)) {
    return "0 classes";
  }
  
  const classes = (minutes / 75).toFixed(decimalPlaces);
  return `${classes} classes`;
}
//==============================REWARD SYSTEM =============================================
// ==========================
// UPDATED PROFILE REWARDS SYSTEM
// ==========================

function updateProfileRewards() {
    const netRewards = calculateNetRewards();
    
    console.log("=== DEBUG: updateProfileRewards() called ===");
    console.log("Total earned:", getTotalEarnedRewards());
    console.log("Deducted:", deductedRewards);
    console.log("Net rewards:", netRewards);
    
    // UPDATE THE SPAN ELEMENT
    const el = document.getElementById("profile-total-coins");
    if (el) {
        console.log("Found #profile-total-coins element, updating with net rewards...");
        el.innerText = `${netRewards} 💰`;
        console.log("Updated element with:", el.innerText);
    } else {
        console.error("ERROR: Could not find #profile-total-coins element!");
    }
    
    // Also update quest reward display if quest is open
    if (currentQuestId && document.getElementById("quest-overlay").style.display === "block") {
        const questRewardEl = document.getElementById("quest-reward");
        if (questRewardEl) {
            // Show individual quest reward (not affected by deductions)
            const questCoins = questRewards[currentQuestId] || 0;
            questRewardEl.innerHTML = questCoins ? `<strong>${questCoins} 💰</strong>` : "—";
        }
    }
}



// ==========================
// WELCOME TOUR SYSTEM - INTEGRATED INTO MAP
// ==========================
let currentTourStep = 0;
let hasCompletedTour = localStorage.getItem("hasCompletedTour") === "true";
let highlightedElements = [];

// Tour steps configuration with positions
const tourSteps = [
  {
    image: "welcome/edu1.png",
    text: "Hail, traveler, and welcome to the kingdom of Artheim. I am here to serve as your guide. ",
    imagePosition: { x: 50, y: 103 }, // Center of screen
    talkBubblePosition: { x: 30, y: 50 }, // Bottom center
    talkBubbleClass: "talk-bubble-bottom-center",
    highlightSelector: "#map-container"
  },
  {
    image: "welcome/edu2.png",
    text: "My name is Eduardo! My purpose is to guide your steps on the journey to come.",
    imagePosition: { x: 50, y: 110 }, // right side
    talkBubblePosition: { x: 10, y: 40 }, // Bottom center
    talkBubbleClass: "talk-bubble-bottom-center",
    highlightSelector: "#map-container"
  },
    {
    image: "welcome/edu3.png",
    text: "You've arrived in Artheim, where every splash of color is a doorway and every sketch tells a tale! Your gallery of quests is open—which masterpiece will you complete first?",
    imagePosition: { x: 95, y: 120 }, // right side
    talkBubblePosition: { x: 60, y: 20 }, // Bottom center
    talkBubbleClass: "talk-bubble-bottom-center",
    highlightSelector: "#map-container"
  },
  {
    image: "welcome/edu4.png",
    text: "Click on a city on the map or any of the monsters to see detailed information",
    imagePosition: { x: 50, y: 420 }, // Top right
    talkBubblePosition: { x: 65, y: 20 }, // Top left
    talkBubbleClass: "talk-bubble-bottom-center",
  },
  { 
    image: "welcome/edu16.png",
    glowEffect: "blue",
    imagePosition: { x: 2, y: 330 },
    text: "The blue quests are our 'Studies in Practice.' Think of them as quick, rewarding formatives—a perfect way to learn the rules of our world before you master the skills.",
    imagePosition: { x: 2, y: 330 }, // Top right
    talkBubblePosition: { x: 0, y: 5 }, // Top left
    talkBubbleClass: "talk-bubble-bottom-center",
    openQuest: "quest1"
  },
  { 
    image: "welcome/edu15.png",
    text: "Then, there are the Golden Quests. These are your summative objectives, the MVPs of this realm. The difficulty is high, but the rewards define a legacy.",
    imagePosition: { x: 2, y: 400 }, // Top right
    talkBubblePosition: { x: 0, y: 25 }, // Top left
    talkBubbleClass: "talk-bubble-bottom-center",
    openQuest: "quest4"
  },

    {
    image: "welcome/edu5.png",
    text: "<b>`The Path`</b> is the discipline you will master (Painting, Watercolor, Sketch, 3D).<br><b>`The Title`</b> is the name of the specific challenge that awaits you.",
    imagePosition: { x: 110, y: 20 }, // Top left
    talkBubblePosition: { x: 80, y: 60 }, // Top right
    talkBubbleClass: "talk-bubble-left",
    openQuest: "quest1",
    highlightSelector: ["#quest-paths", "#quest-title"]
  },
  {
    image: "welcome/edu5.png",
    text: "The <b>'Rationale'</b> explains why this quest is important for your artistic journey.<br>While the <b>Dificulty</b> shows how hard the quest is.",
    imagePosition: { x: 110, y: 20 }, // Top left
    talkBubblePosition: { x: 80, y: 60 }, // Top right
    talkBubbleClass: "talk-bubble-left",
    openQuest: "quest1",
    highlightSelector:"#quest-rationale"
  },
  {
    image: "welcome/edu6.png",
    text: "The <b>'Timer'</b> shows how long you have to finish a quest.<br> When it's close to run out, you will receive a warning!",
    imagePosition: { x: 0, y: 100 }, // Top left
    talkBubblePosition: { x: 30, y: 30 }, // Top right
    talkBubbleClass: "talk-bubble-left",
    openQuest: "quest1",
    highlightSelector:"#quest-accept"
  },
  {
    image: "welcome/edu8.png",
    text: "In the middle you can see all details of you quest.<br><b> Pay Attention!</b>",
    imagePosition: { x: 100, y: 200 }, // Top left
    talkBubblePosition: { x: 65, y: 49 }, // Top right
    talkBubbleClass: "talk-bubble-left",
    openQuest: "quest1",
    highlightSelector:["#quest-character","#quest-text","#quest-requirements"]
  },
  {
    image: "welcome/edu7.png",
    text: "The <b>'Rubric'</b> shows how your work will be assessed. <br>Complete quests to unlock your grading!",
    imagePosition: { x: 45, y: 170 }, // Bottom right
    talkBubblePosition: { x: 75, y: 35 }, // Bottom left
    talkBubbleClass: "talk-bubble-top-right",
    openQuest: "quest1",
    highlightSelector: "#quest-rubric"
  },
    {
    image: "welcome/edu9.png",
    text: "The <b>'Sample'</b> is a MUST see. It will help me to guide you.</br> The <b>'Pre requisites/Leads to'</b> show quests related to the one you are doing.",
    imagePosition: { x: 100, y: 170 }, // Bottom right
    talkBubblePosition: { x: 70, y: 25 }, // Bottom left
    talkBubbleClass: "talk-bubble-top-right",
    openQuest: "quest1",
    highlightSelector: ["#quest-links","#quest-prereq-leads-prereq"]  
  },
  {
    image: "welcome/edu10.png",
    text: "and finally we have the <b>'Reward'</b>. Better grades mean better rewards!!",
    imagePosition: { x: 100, y: 180 }, // Bottom right
    talkBubblePosition: { x: 67, y: 35 }, // Bottom left
    talkBubbleClass: "talk-bubble-top-right",
    openQuest: "quest1",
    highlightSelector: "#quest-reward"
  },
  {
    image: "welcome/edu14.png",
    text: "The <b>'Search'</b> helps you to descover your new adventure. You can search by, title, skill, or any keyword.<br><br> You can also see other maps there.",
    imagePosition: { x: 65, y: 60 }, // Middle right
    talkBubblePosition: { x: 35, y: 40 }, // Middle left
    talkBubbleClass: "talk-bubble-right",
    highlightSelector: "#dropdown-container"
  },

  {
    image: "welcome/edu11.png",
    text: "You can track your progress on you <b>'Profile'</b> button.<br>It tracks your grades and total rewards. You can save your progress there too!",
    imagePosition: { x: 60, y: 80 }, // Bottom left
    talkBubblePosition: { x: 80, y: 20 }, // Top right
    talkBubbleClass: "talk-bubble-bottom-left",
  },
    {
    image: "welcome/edu12.png",
    text: "You can also change your avatar there.",
    imagePosition: { x: 60, y: 80 }, // Bottom left
    talkBubblePosition: { x: 80, y: 20 }, // Top right
    talkBubbleClass: "talk-bubble-bottom-left",
  },
    {
    image: "welcome/edu13.png",
    text: "The <b>'🏆Achievements'</b> shows all quests you completed.<br><br> You can also complete themed groups of quests to get better rewards! <br>Show off your mastery!",
    imagePosition: { x: 90, y: 90 }, // Middle left
    talkBubblePosition: { x: 50, y: 40 }, // Middle right
    talkBubbleClass: "talk-bubble-left",
  },

  {
    image: "welcome/edu17.png",
    text: "Now <b>YOU</b> decide your path!<br><br> Chose your own quests,<br> work hard and show me that you control your destiny!<br><br> Ready to begin your adventure?",
    imagePosition: { x: 50, y: 400 }, // Center
    talkBubblePosition: { x: 50, y: 0 }, // Top center
    talkBubbleClass: "talk-bubble-bottom-center",
  }
];

function showWelcomeTour() {
  // Skip if already completed
  if (hasCompletedTour) return;
  
  // Show tour after a short delay
  setTimeout(() => {
    const container = document.getElementById("welcome-tour-container");
    if (container) {
      container.style.display = "block";
      updateTourStep(0);
    }
  }, 1000);
}

function updateTourStep(stepIndex) {
  const step = tourSteps[stepIndex];
  if (!step) return;
  
  currentTourStep = stepIndex;
  
  // Remove previous highlights
  clearHighlights();
  
// Handle quest opening/closing based on step configuration
  if (step.openQuest) {
    // Close any open quest first
    closeQuest();
    
    // Open the specified quest after a short delay
    setTimeout(() => {
      if (quests[step.openQuest]) {
        openQuest(step.openQuest);
      } else {
        console.warn(`Quest ${step.openQuest} not found in quests data`);
      }
    }, 100);
  } else {
    // Close quest overlay if this step doesn't need it
    closeQuest();
  }
  
  // Update image
  
  // Update image
  const imageElement = document.getElementById("welcome-tour-image");
  const imageWrapper = document.getElementById("welcome-tour-image-wrapper");
  
  if (imageElement && imageWrapper) {
    // Set image source
    imageElement.src = step.image;
    imageElement.alt = `Tour step ${stepIndex + 1}`;
    
    // Position image
    const x = step.imagePosition.x;
    const y = step.imagePosition.y;
    
    imageWrapper.style.left = `${x}%`;
    imageWrapper.style.top = `${y}%`;
    imageWrapper.style.transform = `translate(-${x}%, -${y}%)`;
  }
  
  // Update talk bubble
  const talkBubble = document.getElementById("welcome-tour-talk-bubble");
  if (talkBubble) {
    // Remove all positioning classes
    talkBubble.className = "";
    talkBubble.id = "welcome-tour-talk-bubble";
    
    // Add new positioning class
    if (step.talkBubbleClass) {
      talkBubble.classList.add(step.talkBubbleClass);
    }
    
    // Position talk bubble
    talkBubble.style.left = `${step.talkBubblePosition.x}%`;
    talkBubble.style.top = `${step.talkBubblePosition.y}%`;
    talkBubble.style.transform = `translate(-${step.talkBubblePosition.x}%, -${step.talkBubblePosition.y}%)`;
    
    // Update text and counter
    document.getElementById("welcome-tour-text").innerHTML  = step.text;
    document.getElementById("welcome-tour-counter").textContent = 
      `${stepIndex + 1}/${tourSteps.length}`;
    
    // Update button visibility
    document.getElementById("welcome-tour-prev").style.display = 
      stepIndex === 0 ? "none" : "inline-block";
    
    document.getElementById("welcome-tour-next").style.display = 
      stepIndex === tourSteps.length - 1 ? "none" : "inline-block";
    
    document.getElementById("welcome-tour-finish").style.display = 
      stepIndex === tourSteps.length - 1 ? "inline-block" : "none";
  }
  
  // Highlight relevant element if selector exists
  if (step.highlightSelector) {
    highlightElement(step.highlightSelector);
  }
}

function highlightElement(selector) {
  // Try to find all matching elements
  const elements = document.querySelectorAll(selector);
  
  elements.forEach(element => {
    if (element) {
      // Save original style
      const originalBoxShadow = element.style.boxShadow;
      const originalZIndex = element.style.zIndex;
      const originalPosition = element.style.position;
      
      // Apply highlight
      element.classList.add("tour-highlight");
      element.style.zIndex = "9997";
      
      // Make sure element is visible for highlighting
      if (getComputedStyle(element).display === "none") {
        element.style.display = "block";
      }
      
      // Store for cleanup
      highlightedElements.push({
        element,
        originalBoxShadow,
        originalZIndex,
        originalPosition
      });
    }
  });
}

function clearHighlights() {
  highlightedElements.forEach(item => {
    if (item.element) {
      item.element.classList.remove("tour-highlight");
      item.element.style.boxShadow = item.originalBoxShadow;
      item.element.style.zIndex = item.originalZIndex;
      item.element.style.position = item.originalPosition;
    }
  });
  highlightedElements = [];
    // SPECIAL: Remove highlight from timer button specifically
  const timerButton = document.getElementById("quest-accept");
  if (timerButton) {
    timerButton.classList.remove("tour-highlight");
    timerButton.style.boxShadow = "";
    timerButton.style.outline = "";
  }
}

function nextTourStep() {
  if (currentTourStep < tourSteps.length - 1) {
    updateTourStep(currentTourStep + 1);
  }
}

function prevTourStep() {
  if (currentTourStep > 0) {
    updateTourStep(currentTourStep - 1);
  }
}

function skipTour() {
  if (confirm("Skip the welcome tour? You can always access it from your profile later.")) {
    finishTour();
  }
}

function finishTour() {
  hasCompletedTour = true;
  localStorage.setItem("hasCompletedTour", "true");
  
  // Clear highlights
  clearHighlights();
  
  // Hide tour container
  const container = document.getElementById("welcome-tour-container");
  if (container) {
    container.style.display = "none";
  }
}

function restartTour() {
  hasCompletedTour = false;
  localStorage.removeItem("hasCompletedTour");
  showWelcomeTour();
}

// Initialize tour
function initializeWelcomeTour() {
  // Add event listeners
  const nextButton = document.getElementById("welcome-tour-next");
  const prevButton = document.getElementById("welcome-tour-prev");
  const skipButton = document.getElementById("welcome-tour-skip");
  const finishButton = document.getElementById("welcome-tour-finish");
  
  if (nextButton) nextButton.addEventListener("click", nextTourStep);
  if (prevButton) prevButton.addEventListener("click", prevTourStep);
  if (skipButton) skipButton.addEventListener("click", skipTour);
  if (finishButton) finishButton.addEventListener("click", finishTour);
  
  // Close tour with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const container = document.getElementById("welcome-tour-container");
      if (container && container.style.display === "block") {
        skipTour();
      }
    }
  });
  
  // Make tour interactive (allow clicking on elements being highlighted)
  document.addEventListener("click", (e) => {
    if (hasCompletedTour) return;
    
    const container = document.getElementById("welcome-tour-container");
    if (!container || container.style.display !== "block") return;
    
    // If user clicks on a highlighted element, advance tour
    const highlightedElement = e.target.closest(".tour-highlight");
    if (highlightedElement) {
      nextTourStep();
    }
    
    // If user clicks on the map, maybe advance to next step if appropriate
    if (e.target.closest("#map-container") && currentTourStep === 0) {
      nextTourStep();
    }
  });
}

// Add restart tour button to profile
function addRestartTourToProfile() {
  const restartBtn = document.getElementById("restart-tour-btn");
  
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      // Close profile overlay
      document.getElementById("profile-overlay").style.display = "none";
      
      // Restart the tour
      restartTour();
    });
  } else {
    console.warn("Restart tour button not found in the DOM");
  }
}

// Update your existing functions to integrate with tour
function selectCharacter(character) {
  const profile = {
    name: document.getElementById("student-name-input").value.trim(),
    character: character.image
  };

  saveStudentProfile(profile);
  updateProfileUI();

  const setupOverlay = document.getElementById("student-setup-overlay");
  if (setupOverlay) {
    setupOverlay.style.display = "none";
  }
  
  // Start welcome tour after profile is created
  setTimeout(showWelcomeTour, 500);
}

// Add CSS for talk bubble pointer positions
function addTourStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .talk-bubble-top-left:after {
      top: -30px;
      left: 20px;
      border-color: transparent transparent rgba(24, 31, 141, 0.726) transparent;
    }
    
    .talk-bubble-top-right:after {
      top: -30px;
      right: 20px;
      border-color: transparent transparent rgba(24, 31, 141, 0.726)transparent;
    }
    
    .talk-bubble-bottom-left:after {
      bottom: -30px;
      left: 20px;
      border-color: rgba(24, 31, 141, 0.726) transparent transparent transparent;
    }
    
    .talk-bubble-bottom-right:after {
      bottom: -30px;
      right: 50px;
      border-color: rgba(24, 31, 141, 0.726) transparent transparent transparent;
    }
    
    .talk-bubble-left:after {
      left: -30px;
      top: 50%;
      transform: translateY(-50%);
      border-color: transparent rgba(24, 31, 141, 0.726) transparent transparent;
    }
    
    .talk-bubble-right:after {
      right: -30px;
      top: 50%;
      transform: translateY(-0%);
      border-color: transparent transparent transparent rgba(24, 31, 141, 0.726);
    }
    
    .talk-bubble-bottom-center:after {
      bottom: -30px;
      left: 50%;
      transform: translateX(-50%);
      border-color: rgba(24, 31, 141, 0.726) transparent transparent transparent;
    }
    
    .talk-bubble-top-center:after {
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      border-color: transparent transparent rgba(24, 31, 141, 0.726) transparent;
    }
  `;
  document.head.appendChild(style);
}

// Update DOMContentLoaded to initialize tour
document.addEventListener("DOMContentLoaded", () => {
  updateProfileUI();
  recalculateAllQuestRewards();
  
  // Add tour styles
  addTourStyles();
  
  // Initialize tour system
  initializeWelcomeTour();
  
  // Check if we should show tour for returning users
  const profile = loadStudentProfile();
  if (profile && profile.name && !hasCompletedTour) {
    setTimeout(showWelcomeTour, 1000);
  }
  
  // Add restart button to profile
  addRestartTourToProfile();
  
  // ... rest of your existing code ...
});

// Also update initializeStudentSetup
function initializeStudentSetup() {
  const profile = loadStudentProfile();

  // If profile exists, skip setup and welcome
  if (profile && profile.name) {
    updateProfileUI();
    return;
  }

  // show welcome overlay first
  showWelcomeOverlay();
}
function openElementInsideQuest(elementType, questId) {
  // ... your existing rationale/rubric code ...
  
  switch(elementType.toLowerCase()) {
    // ... your existing cases for rubric, rationale, timer ...
    
    case "profile":
      // Open profile overlay
      const profileBtn = document.getElementById("profile-btn");
      if (profileBtn) {
        // Store current onclick
        if (profileBtn.onclick && !profileBtn.dataset.originalOnclick) {
          profileBtn.dataset.originalOnclick = profileBtn.onclick.toString();
        }
        
        // Simulate click
        const profileOverlay = document.getElementById("profile-overlay");
        if (profileOverlay) {
          profileOverlay.style.display = "flex";
          
          // Update profile data for demo
          updateProfileStandardsTable();
          renderRadarChart();
          updateProfileRewards();
        }
      }
      break;
      
    case "achievements":
      // Open achievements overlay
      const achievementsBtn = document.getElementById("achievements-btn");
      if (achievementsBtn) {
        // Store current onclick
        if (achievementsBtn.onclick && !achievementsBtn.dataset.originalOnclick) {
          achievementsBtn.dataset.originalOnclick = achievementsBtn.onclick.toString();
        }
        
        // Simulate click
        const achievementsOverlay = document.getElementById("achievements-overlay");
        if (achievementsOverlay) {
          achievementsOverlay.style.display = "flex";
          
          // Render achievements for demo
          renderCompletedQuests();
          renderAchievementsList();
        }
      }
      break;
      
    default:
      console.log(`Element type ${elementType} not recognized`);
  }
}
function showCharacterSetup() {
  const setupOverlay = document.getElementById("student-setup-overlay");
  if (!setupOverlay) return;
  
  // Load available characters
  loadAvailableCharacters();
  
  setupOverlay.style.display = "flex";
  
  // Add event listener for name submission
  const nameSubmitBtn = document.getElementById("student-name-submit");
  const nameInput = document.getElementById("student-name-input");
  
  if (nameSubmitBtn && nameInput) {
    nameSubmitBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert("Please enter your name to continue.");
        return;
      }
      
      // Show character selection
      document.getElementById("character-selection").style.display = "block";
      nameSubmitBtn.style.display = "none";
      nameInput.style.display = "none";
      document.querySelector("#student-setup-overlay .scroll-body p").style.display = "none";
    });
  }
}

function loadAvailableCharacters() {
  const charactersList = document.getElementById("characters-list");
  if (!charactersList) return;
  
  // Clear existing characters
  charactersList.innerHTML = "";
  
  // Load characters from JSON file
  fetch('characters/characters.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load characters.json');
      }
      return response.json();
    })
    .then(charFiles => {
      // Create character selection buttons
      charFiles.forEach((charFile, index) => {
        const charDiv = document.createElement("div");
        charDiv.className = "character-option";
        charDiv.innerHTML = `
          <img src="characters/${charFile}" alt="Character ${index + 1}" />
        `;
        
        charDiv.addEventListener("click", () => selectCharacter({
          id: `character${index + 1}`,
          image: `characters/${charFile}`
        }));
        
        charactersList.appendChild(charDiv);
      });
    })
    .catch(error => {
      console.error('Error loading characters:', error);
      
      // Fallback if JSON fails
      const fallbackChars = ['char1.gif', 'char2.gif', 'char3.gif', 'char5.gif'];
      
      fallbackChars.forEach((charFile, index) => {
        const charDiv = document.createElement("div");
        charDiv.className = "character-option";
        charDiv.innerHTML = `
          <img src="characters/${charFile}" alt="Character ${index + 1}" />
        `;
        
        charDiv.addEventListener("click", () => selectCharacter({
          id: `character${index + 1}`,
          image: `characters/${charFile}`
        }));
        
        charactersList.appendChild(charDiv);
      });
    });
}
// ==========================
// QUEST LIST FUNCTIONS
// ==========================

function renderQuestList(filter = 'all') {
  const container = document.getElementById('questlist-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!quests || Object.keys(quests).length === 0) {
    container.innerHTML = '<div class="questlist-empty">Loading quests...</div>';
    return;
  }
  
  let filteredQuests = [];
  
  // Apply filter
  switch(filter) {
    case 'active':
      filteredQuests = Object.entries(quests).filter(([id, quest]) => 
        questAccepted[id] && quest.timer
      );
      break;
      
    case 'paintersPath':
    case 'sketcherPath':
    case 'watercoloursPath':
    case '3DPath':
      // Map filter value to actual path names in JSON
      const pathMap = {
        'paintersPath': 'Painter Path',
        'sketcherPath': 'Sketcher Path', 
        'watercoloursPath': 'Watercolor Path',
        '3DPath': '3D Path'
      };
      
      const targetPath = pathMap[filter];
      
      filteredQuests = Object.entries(quests).filter(([id, quest]) => {
        if (!quest.path) return false;
        
        // Check if quest.path array contains the target path
        if (Array.isArray(quest.path)) {
          return quest.path.includes(targetPath);
        }
        return false;
      });
      break;
      
    default: // 'all'
      filteredQuests = Object.entries(quests);
  }
  
  // Sort by ID for consistent ordering
  filteredQuests.sort(([idA], [idB]) => {
    const numA = parseInt(idA.replace('quest', '')) || 0;
    const numB = parseInt(idB.replace('quest', '')) || 0;
    return numA - numB;
  });
  
  // Update count
  document.getElementById('questlist-count').textContent = 
    `${filteredQuests.length} ${filter === 'all' ? 'total' : 'filtered'} quest${filteredQuests.length !== 1 ? 's' : ''}`;
  
  if (filteredQuests.length === 0) {
    container.innerHTML = '<div class="questlist-empty">No quests match your filter</div>';
    return;
  }
  
  // Render each quest (keep the rest of your existing rendering code)
  filteredQuests.forEach(([id, quest]) => {
    const isActive = questAccepted[id] && quest.timer;
    const isCompleted = completedQuests[id];
    
    const questElement = document.createElement('div');
    questElement.className = `questlist-item ${isActive ? 'active' : ''}`;
    questElement.dataset.questId = id;
    
    // Format timer display
    let timerDisplay = '';
    if (quest.timer) {
      const allottedMinutes = quest.timer.allottedMinutes || 0;
      const classes = Math.round(allottedMinutes / 75);
      timerDisplay = `${allottedMinutes} min (${classes} class${classes !== 1 ? 'es' : ''})`;
    }
    
    // Get path display
    let pathDisplay = 'No path assigned';
    if (quest.path && Array.isArray(quest.path)) {
      pathDisplay = quest.path.join(', ');
    }
    
    questElement.innerHTML = `
      <div class="questlist-header">
        <h3 class="questlist-title">${quest.title || 'Untitled Quest'}</h3>
        <span class="questlist-id">${id}</span>
      </div>
      <div class="questlist-details">
        <div>
          <span class="questlist-path">${pathDisplay}</span>
          ${quest.timer ? `<span class="questlist-timer ${isActive ? 'active' : ''}">⏱ ${timerDisplay}</span>` : ''}
        </div>
        <div>
          ${isCompleted ? '<span class="questlist-completed">✓ Completed</span>' : ''}
          ${isActive ? '<span class="questlist-timer active">🔴 Active</span>' : ''}
        </div>
      </div>
    `;
    
    // Add click event
    questElement.addEventListener('click', () => {
      document.getElementById('achievements-overlay').style.display = 'none';
      openQuest(id);
    });
    
    container.appendChild(questElement);
  });
}
// Initialize quest list functionality
function initializeQuestList() {
  const filterSelect = document.getElementById('questlist-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      renderQuestList(e.target.value);
    });
  }
  
  // No additional event listener needed - tab switching is handled elsewhere
}

// Tab switching logic (this is already in your code, just ensure it has the questlist logic)
document.querySelectorAll(".achievements-tabs .tab-button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none");
    document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
    
    // Only render if it's the questlist tab AND if it hasn't been rendered yet
    if (btn.dataset.tab === "questlist") {
      const container = document.getElementById('questlist-container');
      // Check if container is empty before rendering
      if (!container || container.innerHTML.trim() === '') {
        renderQuestList(document.getElementById("questlist-filter").value);
      }
    }
  });
});
// Add this to your existing JS file

// ==========================
// RESPONSIVE HELPER FUNCTIONS
// ==========================

// Handle orientation changes
function handleOrientationChange() {
  const isPortrait = window.innerHeight > window.innerWidth;
  
  if (isPortrait && window.innerWidth < 768) {
    // Portrait mode on mobile - adjust hotspots if needed
    document.querySelectorAll('.hotspot').forEach(hotspot => {
      hotspot.style.transform = 'translate(-50%, -50%) scale(1.2)';
    });
  } else {
    // Landscape or desktop - reset
    document.querySelectorAll('.hotspot').forEach(hotspot => {
      hotspot.style.transform = 'translate(-50%, -50%)';
    });
  }
  
  // Recalculate radar chart if profile is open
  if (document.getElementById('profile-overlay').style.display === 'flex') {
    renderRadarChart();
  }
}

// Touch event handling improvements
function initializeTouchEvents() {
  // Prevent double-tap zoom on interactive elements
  document.addEventListener('touchstart', function(e) {
    if (e.target.tagName === 'BUTTON' || 
        e.target.tagName === 'SELECT' ||
        e.target.classList.contains('hotspot') ||
        e.target.classList.contains('tab-button')) {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }
  }, { passive: false });
  
  // Add touch feedback
  document.addEventListener('touchstart', function(e) {
    const target = e.target;
    if (target.tagName === 'BUTTON' || 
        target.classList.contains('tab-button') ||
        target.classList.contains('profile-btn-small') ||
        target.classList.contains('hotspot')) {
      target.classList.add('touch-active');
    }
  });
  
  document.addEventListener('touchend', function(e) {
    const target = e.target;
    if (target.classList.contains('touch-active')) {
      setTimeout(() => {
        target.classList.remove('touch-active');
      }, 150);
    }
  });
}

// Adjust hotspot positions for different screen sizes
function adjustHotspotPositions() {
  const baseWidth = 813;
  const baseHeight = 585;
  const currentWidth = window.innerWidth;
  const currentHeight = window.innerHeight;
  
  // Only adjust if significantly different from base size
  if (currentWidth < 768 || currentHeight < 600) {
    const scaleX = currentWidth / baseWidth;
    const scaleY = currentHeight / baseHeight;
    const scale = Math.min(scaleX, scaleY);
    
    document.querySelectorAll('.hotspot').forEach(hotspot => {
      const top = parseFloat(hotspot.style.top);
      const left = parseFloat(hotspot.style.left);
      
      if (!isNaN(top) && !isNaN(left)) {
        // Adjust position based on scale
        hotspot.style.top = `${top * scaleY}%`;
        hotspot.style.left = `${left * scaleX}%`;
      }
    });
  }
}

// Initialize responsive behaviors
function initializeResponsiveBehaviors() {
  // Handle initial load
  handleOrientationChange();
  adjustHotspotPositions();
  initializeTouchEvents();
  
  // Add event listeners
  window.addEventListener('resize', () => {
    handleOrientationChange();
    adjustHotspotPositions();
  });
  
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      handleOrientationChange();
      adjustHotspotPositions();
    }, 300);
  });
}

// Add to your existing DOMContentLoaded event
document.addEventListener("DOMContentLoaded", () => {
  // ... your existing code ...
  
  // Add responsive initialization
  initializeResponsiveBehaviors();
  
  // ... rest of your code ...

});

