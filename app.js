(function () {
  const items = Array.isArray(window.KNOWLEDGE_ITEMS) ? window.KNOWLEDGE_ITEMS : [];
  const storageKeys = {
    progress: "adTrainer.progress",
    wrongQuestions: "adTrainer.wrongQuestions",
    settings: "adTrainer.settings"
  };

  const state = {
    view: "dashboard",
    query: "",
    category: "all",
    mastery: "all",
    practiceCategory: "all",
    detailId: items[0]?.id || "",
    flashQueue: [],
    flashIndex: 0,
    flashAnswerVisible: false,
    quizQueue: [],
    quizIndex: 0,
    selectedAnswer: "",
    fillAnswer: "",
    submitted: null
  };

  const progress = loadJson(storageKeys.progress, { masteryByTermId: {}, practiceHistory: [] });
  const wrongQuestions = loadJson(storageKeys.wrongQuestions, {});
  const settings = loadJson(storageKeys.settings, { lastCategory: "all" });
  state.practiceCategory = settings.lastCategory || "all";

  const categories = [...new Set(items.map((item) => item.category))];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const properNouns = new Set([
    "Meta", "TikTok", "AppLovin", "Google AdMob", "Unity Ads", "AdMob", "Amazon Ads",
    "LeadsBridge", "Zapier", "DealerSocket", "Redtail", "Axon AI", "MAX"
  ]);
  const termTranslations = {
    "广告联盟/网盟": "Ad Network",
    "优先跑量": "Volume First",
    "优先低成本": "Cost First",
    "均衡投放": "Balanced Delivery",
    "数据回传": "Data Feedback",
    "浅层事件": "Upper-funnel Event",
    "深转事件": "Deep Conversion Event",
    "深转渗透率": "Deep Conversion Penetration",
    "线索（Lead）": "Lead",
    "留资": "Lead Submission",
    "归因": "Attribution",
    "A/B测试": "A/B Test",
    "合约广告": "Reservation Ads",
    "竞价广告": "Auction Ads",
    "程序化广告": "Programmatic Advertising",
    "本地广告": "Direct-sold Ads",
    "召回（Recall）": "Recall",
    "粗排": "Coarse Ranking",
    "精排": "Fine Ranking",
    "冷启动探索": "Cold Start Exploration",
    "样本学习": "Sample Learning",
    "模型学习期": "Model Learning Phase",
    "非中市场": "Non-China Market",
    "美国网盟市场": "US Ad Network Market",
    "高意向表单": "Higher Intent Form",
    "条件逻辑": "Conditional Logic",
    "自定义事件": "Custom Event",
    "自定义转化": "Custom Conversion",
    "标准事件": "Standard Event",
    "平台内表单": "Instant Form",
    "网站表单": "Website Form",
    "匹配率": "Match Rate",
    "归因率": "Attribution Rate"
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function masteryOf(item) {
    return progress.masteryByTermId[item.id] || item.mastery || 2;
  }

  function setMastery(itemId, value) {
    progress.masteryByTermId[itemId] = Math.max(1, Math.min(5, Number(value)));
    saveJson(storageKeys.progress, progress);
    render();
  }

  function masteryLabel(value) {
    return {
      1: "完全不会",
      2: "有印象",
      3: "基本理解",
      4: "比较熟练",
      5: "完全掌握"
    }[value] || "有印象";
  }

  function summarizeStats() {
    const mastered = items.filter((item) => masteryOf(item) >= 4).length;
    const weak = items.filter((item) => masteryOf(item) <= 2).length;
    return {
      total: items.length,
      mastered,
      due: items.length - mastered,
      weak,
      mistakes: Object.keys(wrongQuestions).length
    };
  }

  function byQueryAndFilters() {
    const q = state.query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !q || `${item.term} ${item.definition} ${item.category}`.toLowerCase().includes(q);
      const matchesCategory = state.category === "all" || item.category === state.category;
      const level = masteryOf(item);
      const matchesMastery = state.mastery === "all" ||
        (state.mastery === "weak" && level <= 2) ||
        (state.mastery === "learning" && level === 3) ||
        (state.mastery === "mastered" && level >= 4);
      return matchesQuery && matchesCategory && matchesMastery;
    });
  }

  function optionHtml(selected) {
    return `<option value="all"${selected === "all" ? " selected" : ""}>全部分类</option>` +
      categories.map((category) => `<option value="${escapeAttr(category)}"${selected === category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("");
  }

  function render() {
    updateChrome();
    if (state.view === "dashboard") renderDashboard();
    if (state.view === "library") renderLibrary();
    if (state.view === "detail") renderDetail();
    if (state.view === "flashcards") renderFlashcards();
    if (state.view === "practice") renderPractice();
    if (state.view === "mistakes") renderMistakes();
  }

  function updateChrome() {
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
    document.querySelector(`#${state.view}View`)?.classList.add("is-active");
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === state.view);
    });
    const title = {
      dashboard: "首页 Dashboard",
      library: "知识库",
      detail: "知识点详情",
      flashcards: "闪卡复习",
      practice: "题目练习",
      mistakes: "错题本"
    }[state.view];
    document.querySelector("#viewTitle").textContent = title;
    document.querySelector("#resetFiltersBtn").style.display = state.view === "library" ? "" : "none";
    document.querySelector("#resetProgressBtn").style.display = state.view === "dashboard" ? "" : "none";
  }

  function renderDashboard() {
    const stats = summarizeStats();
    const weakItems = [...items].sort((a, b) => masteryOf(a) - masteryOf(b)).slice(0, 6);
    const masteredPct = Math.round((stats.mastered / Math.max(stats.total, 1)) * 100);
    document.querySelector("#dashboardView").innerHTML = `
      <div class="dashboard-grid">
        <section class="hero-panel">
          <div class="hero-head">
            <button class="primary-button hero-cta" data-action="start-flash">开始今日复习</button>
            <div>
              <p class="hero-kicker">TODAY'S MISSION</p>
              <h3>今天先拿下 ${Math.min(stats.weak || stats.due, 12)} 个薄弱知识点</h3>
              <p>把容易混淆的广告术语变成肌肉记忆。先复习，再练题，一轮大概 5 分钟。</p>
            </div>
          </div>
          <div class="hero-content mission-status">
            <div class="progress-ring" style="--progress:${masteredPct}%">
              <span>${masteredPct}%</span>
              <small>掌握</small>
            </div>
            <div class="hero-copy">
              <div class="streak-card">
                <strong>${practiceStreak()} 天</strong>
                <span>连续学习</span>
              </div>
              <div class="heatmap" aria-label="近 28 次学习热力">
                ${heatmapCells()}
              </div>
            </div>
          </div>
          <div class="card-actions hero-actions">
            <button class="secondary-button" data-action="start-practice">快速练习</button>
            <button class="ghost-button" data-action="open-library">进入知识库</button>
          </div>
        </section>

        <aside class="status-panel">
          <div class="section-title">
            <h3>学习状态</h3>
          </div>
          <div class="mini-stats">
            ${statCard("📖", "总知识点", stats.total, "全量术语")}
            ${statCard("🏆", "已掌握", stats.mastered, "4-5 级")}
            ${statCard("🔥", "待复习", stats.due, "低于 4 级")}
            ${statCard("⚠️", "错题", stats.mistakes, "需要回看")}
          </div>
        </aside>
      </div>

      <section class="tool-panel weak-panel">
        <div class="section-title">
          <h3>薄弱知识点</h3>
          <span class="pill pill-warn">${stats.weak} 个待巩固</span>
        </div>
        <div class="weak-grid">
          ${weakItems.map((item) => compactRow(item)).join("")}
        </div>
      </section>
    `;
  }

  function statCard(icon, label, value, note) {
    return `
      <section class="stat-card">
        <div class="stat-icon">${icon}</div>
        <p class="stat-label">${label}</p>
        <div class="stat-value">${value}</div>
        <p class="stat-note">${note}</p>
      </section>
    `;
  }

  function compactRow(item) {
    const level = masteryOf(item);
    return `
      <div class="list-row">
        <div>
          <div class="row-title">
            ${brandMark(item)}
            <h4>${escapeHtml(termDisplayName(item))}</h4>
          </div>
          <p>${escapeHtml(item.category)} · ${escapeHtml(item.summary)}</p>
          <div class="skill-bar" aria-label="熟练度 ${level}/5"><span style="width:${level * 20}%"></span></div>
        </div>
        <button class="ghost-button" data-action="detail" data-id="${escapeAttr(item.id)}">查看</button>
      </div>
    `;
  }

  function renderLibrary() {
    const filtered = byQueryAndFilters();
    document.querySelector("#libraryView").innerHTML = `
      <div class="controls">
        <input class="control" id="searchInput" type="search" placeholder="搜索术语、分类或解释" value="${escapeAttr(state.query)}">
        <select class="select" id="categoryFilter">${optionHtml(state.category)}</select>
        <select class="select" id="masteryFilter">
          <option value="all"${state.mastery === "all" ? " selected" : ""}>全部掌握度</option>
          <option value="weak"${state.mastery === "weak" ? " selected" : ""}>薄弱</option>
          <option value="learning"${state.mastery === "learning" ? " selected" : ""}>基本理解</option>
          <option value="mastered"${state.mastery === "mastered" ? " selected" : ""}>已掌握</option>
        </select>
      </div>
      <div class="section-title">
        <h3>${filtered.length} 个知识点</h3>
        <span class="pill">${state.category === "all" ? "全分类" : escapeHtml(state.category)}</span>
      </div>
      ${filtered.length ? `<div class="term-grid">${filtered.map(termCard).join("")}</div>` : emptyState("没有匹配的知识点")}
    `;
    document.querySelector("#searchInput").focus({ preventScroll: true });
  }

  function termCard(item) {
    const level = masteryOf(item);
    return `
      <article class="term-card">
        <div class="meta-line">
          ${brandMark(item)}
          <span class="pill category-pill ${categoryClass(item.category)}">${escapeHtml(item.category)}</span>
          <span class="mastery-pill level-${level}">${level} · ${masteryLabel(level)}</span>
        </div>
        <h4>${escapeHtml(termDisplayName(item))}</h4>
        <p>${escapeHtml(item.summary)}</p>
        <div class="skill-bar library-skill" aria-label="熟练度 ${level}/5"><span style="width:${level * 20}%"></span></div>
        <div class="card-actions">
          <button class="primary-button" data-action="detail" data-id="${escapeAttr(item.id)}">详情</button>
          <button class="ghost-button" data-action="practice-item" data-id="${escapeAttr(item.id)}">练习</button>
        </div>
      </article>
    `;
  }

  function renderDetail() {
    const item = itemById.get(state.detailId) || items[0];
    if (!item) {
      document.querySelector("#detailView").innerHTML = emptyState("还没有知识点数据");
      return;
    }
    const level = masteryOf(item);
    document.querySelector("#detailView").innerHTML = `
      <section class="detail-hero">
        <div class="meta-line">
          <span class="pill">${escapeHtml(item.category)}</span>
          <span class="mastery-pill level-${level}">${level} · ${masteryLabel(level)}</span>
        </div>
        <h3>${escapeHtml(item.term)}</h3>
        <p class="definition">${escapeHtml(item.definition)}</p>
        <div class="progress-track">
          <div class="progress-fill" style="width:${level * 20}%"></div>
        </div>
        <div class="row-actions">
          <button class="primary-button" data-action="practice-item" data-id="${escapeAttr(item.id)}">开始练习</button>
          <button class="ghost-button" data-action="back-library">返回知识库</button>
        </div>
      </section>

      <div class="grid two-col" style="margin-top:16px">
        <section class="tool-panel">
          <div class="section-title"><h3>掌握程度</h3></div>
          <div class="row-actions">
            ${[1, 2, 3, 4, 5].map((value) => `<button class="${value === level ? "secondary-button" : "ghost-button"}" data-action="set-mastery" data-id="${escapeAttr(item.id)}" data-level="${value}">${value} · ${masteryLabel(value)}</button>`).join("")}
          </div>
        </section>
        <section class="tool-panel">
          <div class="section-title"><h3>相关术语</h3></div>
          <div class="meta-line">
            ${item.relatedTerms.map((term) => `<span class="pill">${escapeHtml(term)}</span>`).join("") || "<span class='muted'>暂无</span>"}
          </div>
        </section>
      </div>
    `;
  }

  function renderFlashcards() {
    if (!state.flashQueue.length) {
      state.flashQueue = buildFlashQueue();
      state.flashIndex = 0;
      state.flashAnswerVisible = false;
    }
    const item = state.flashQueue[state.flashIndex];
    if (!item) {
      document.querySelector("#flashcardsView").innerHTML = emptyState("没有可复习的知识点");
      return;
    }
    document.querySelector("#flashcardsView").innerHTML = `
      <section class="study-stage">
        <div class="flashcard">
          <div class="flashcard-inner ${state.flashAnswerVisible ? "is-flipped" : ""}">
            <div class="flash-face flash-face-front" aria-hidden="${state.flashAnswerVisible ? "true" : "false"}">
              <div class="meta-line">
                <span class="pill category-pill ${categoryClass(item.category)}">${escapeHtml(item.category)}</span>
                <span class="mastery-pill level-${masteryOf(item)}">${masteryLabel(masteryOf(item))}</span>
                <span class="pill">${state.flashIndex + 1} / ${state.flashQueue.length}</span>
              </div>
              <p class="flash-question">什么是<span>${escapeHtml(item.term)}</span>？</p>
              <p class="flash-hint">点击右下角翻转查看答案</p>
              <button class="flip-button" data-action="toggle-flash" type="button" ${state.flashAnswerVisible ? "tabindex=\"-1\"" : ""}>↻ 翻转</button>
            </div>
            <div class="flash-face flash-face-back" aria-hidden="${state.flashAnswerVisible ? "false" : "true"}">
              <div class="meta-line">
                <span class="pill category-pill ${categoryClass(item.category)}">${escapeHtml(item.category)}</span>
                <span class="mastery-pill level-${masteryOf(item)}">${masteryLabel(masteryOf(item))}</span>
                <span class="pill">${state.flashIndex + 1} / ${state.flashQueue.length}</span>
              </div>
              <p class="flash-question">什么是<span>${escapeHtml(item.term)}</span>？</p>
              <div class="flash-answer">${escapeHtml(item.definition)}</div>
              <button class="flip-button" data-action="toggle-flash" type="button" ${state.flashAnswerVisible ? "" : "tabindex=\"-1\""}>↻ 翻转</button>
            </div>
          </div>
        </div>
        <div class="row-actions study-actions">
          ${state.flashAnswerVisible ? `
            <button class="rate-button rate-strong" data-action="flash-rate" data-id="${escapeAttr(item.id)}" data-level="5">已掌握</button>
            <button class="rate-button rate-soft" data-action="flash-rate" data-id="${escapeAttr(item.id)}" data-level="3">有点模糊</button>
            <button class="rate-button rate-weak" data-action="flash-rate" data-id="${escapeAttr(item.id)}" data-level="1">不会</button>
          ` : ""}
        </div>
      </section>
    `;
  }

  function buildFlashQueue() {
    const weak = items.filter((item) => masteryOf(item) < 4);
    const pool = weak.length ? weak : items;
    return shuffle([...pool].sort((a, b) => masteryOf(a) - masteryOf(b) || a.term.localeCompare(b.term, "zh-CN"))).slice(0, 24);
  }

  function renderPractice() {
    if (!state.quizQueue.length) {
      state.quizQueue = buildQuizQueue(state.practiceCategory);
      state.quizIndex = 0;
      state.selectedAnswer = "";
      state.fillAnswer = "";
      state.submitted = null;
    }
    const question = state.quizQueue[state.quizIndex];
    document.querySelector("#practiceView").innerHTML = `
      <div class="controls study-controls">
        <select class="select" id="practiceCategory">${optionHtml(state.practiceCategory)}</select>
        <button class="secondary-button" data-action="restart-quiz">重新生成题目</button>
        <button class="ghost-button" data-action="open-mistakes">查看错题</button>
      </div>
      ${question ? renderQuestion(question) : emptyState("当前分类没有可练习的题目")}
    `;
  }

  function renderQuestion(question) {
    const item = itemById.get(question.termId);
    const submitted = state.submitted;
    return `
      <section class="question-card">
        <div class="meta-line">
          <span class="pill category-pill ${categoryClass(item?.category || "")}">${escapeHtml(question.typeLabel)}</span>
          <span class="pill">${escapeHtml(item?.category || "")}</span>
          <span class="pill">${state.quizIndex + 1} / ${state.quizQueue.length}</span>
        </div>
        <h3>${escapeHtml(question.prompt)}</h3>
        ${question.type === "fill" ? `
          <textarea class="textarea" id="fillAnswer" placeholder="输入你的答案">${escapeHtml(state.fillAnswer)}</textarea>
        ` : `
          <div class="question-options">
            ${question.options.map((option, index) => {
              const isSelected = state.selectedAnswer === option;
              const answerClass = submitted
                ? option === question.answer ? " is-correct" : isSelected ? " is-wrong" : ""
                : isSelected ? " is-selected" : "";
              return `<button class="choice-button${answerClass}" data-action="choose-answer" data-answer="${escapeAttr(option)}"><span class="choice-key">${optionLabel(index)}</span><span>${escapeHtml(option)}</span></button>`;
            }).join("")}
          </div>
        `}
        <div class="row-actions">
          <button class="primary-button" data-action="submit-answer" ${submitted ? "disabled" : ""}>提交答案</button>
          <button class="ghost-button" data-action="next-question">下一题</button>
        </div>
        ${submitted ? `
          <div class="answer-box${submitted.correct ? "" : " is-wrong"}">
            <strong>${submitted.correct ? "✓ 回答正确" : "× 回答错误"}</strong>
            <p>正确答案：${escapeHtml(question.answer)}</p>
            <p>${escapeHtml(question.explanation)}</p>
          </div>
        ` : ""}
      </section>
    `;
  }

  function buildQuizQueue(category, preferredIds) {
    const source = preferredIds?.length
      ? preferredIds.map((id) => itemById.get(id)).filter(Boolean)
      : items.filter((item) => category === "all" || item.category === category);
    return shuffle(source.flatMap((item) => buildQuestionsFor(item))).slice(0, 20);
  }

  function buildQuestionsFor(item) {
    const distractors = shuffle(items.filter((candidate) => candidate.id !== item.id)).slice(0, 3);
    const wrongDefinition = distractors[0]?.definition || "该术语用于描述广告预算消耗。";
    const useCorrectTrueFalse = hashCode(item.id) % 2 === 0;
    return [
      {
        id: `${item.id}:choice`,
        termId: item.id,
        type: "choice",
        typeLabel: "单选题",
        prompt: `以下哪项最符合“${item.term}”的含义？`,
        options: shuffle([item.definition, ...distractors.map((d) => d.definition)]),
        answer: item.definition,
        explanation: item.definition
      },
      {
        id: `${item.id}:judge`,
        termId: item.id,
        type: "judge",
        typeLabel: "判断题",
        prompt: `判断：“${item.term}”指的是：${useCorrectTrueFalse ? item.definition : wrongDefinition}`,
        options: ["正确", "错误"],
        answer: useCorrectTrueFalse ? "正确" : "错误",
        explanation: `“${item.term}”的准确解释是：${item.definition}`
      },
      {
        id: `${item.id}:fill`,
        termId: item.id,
        type: "fill",
        typeLabel: "填空题",
        prompt: `根据解释写出术语：${item.definition}`,
        options: [],
        answer: item.term,
        explanation: `对应术语是“${item.term}”。`
      }
    ];
  }

  function renderMistakes() {
    const wrongs = Object.values(wrongQuestions).sort((a, b) => b.wrongCount - a.wrongCount || b.lastWrongAt - a.lastWrongAt);
    document.querySelector("#mistakesView").innerHTML = wrongs.length ? `
      <div class="list">
        ${wrongs.map((wrong) => {
          const item = itemById.get(wrong.termId);
          return `
            <article class="list-row">
              <div>
                <h4>${escapeHtml(item?.term || "未知术语")} · ${wrong.wrongCount} 次</h4>
                <p>${escapeHtml(wrong.prompt)}</p>
                <p>答案：${escapeHtml(wrong.answer)}</p>
              </div>
              <button class="primary-button" data-action="practice-item" data-id="${escapeAttr(wrong.termId)}">重新练习</button>
            </article>
          `;
        }).join("")}
      </div>
    ` : emptyState("太棒了！目前没有错题，继续保持哦～", "study");
  }

  function submitAnswer() {
    const question = state.quizQueue[state.quizIndex];
    if (!question || state.submitted) return;
    const item = itemById.get(question.termId);
    const userAnswer = question.type === "fill" ? state.fillAnswer : state.selectedAnswer;
    if (!String(userAnswer).trim()) return;
    const correct = question.type === "fill"
      ? normalizeAnswer(userAnswer).includes(normalizeAnswer(question.answer)) || normalizeAnswer(question.answer).includes(normalizeAnswer(userAnswer))
      : userAnswer === question.answer;
    state.submitted = { correct };
    if (item) {
      const nextLevel = correct ? Math.min(5, masteryOf(item) + 1) : Math.max(1, masteryOf(item) - 1);
      progress.masteryByTermId[item.id] = nextLevel;
      progress.practiceHistory.push({ questionId: question.id, termId: item.id, correct, at: Date.now() });
      progress.practiceHistory = progress.practiceHistory.slice(-200);
      saveJson(storageKeys.progress, progress);
    }
    if (!correct) {
      const record = wrongQuestions[question.id] || {
        id: question.id,
        termId: question.termId,
        type: question.type,
        prompt: question.prompt,
        answer: question.answer,
        explanation: question.explanation,
        wrongCount: 0,
        lastWrongAt: 0
      };
      record.wrongCount += 1;
      record.lastWrongAt = Date.now();
      wrongQuestions[question.id] = record;
      saveJson(storageKeys.wrongQuestions, wrongQuestions);
    }
    renderPractice();
  }

  function nextQuestion() {
    state.quizIndex = (state.quizIndex + 1) % Math.max(state.quizQueue.length, 1);
    state.selectedAnswer = "";
    state.fillAnswer = "";
    state.submitted = null;
    renderPractice();
  }

  function emptyState(text, icon = "✦") {
    const illustration = icon === "study"
      ? `<div class="empty-illustration" aria-hidden="true"><div class="person-head"></div><div class="person-body"></div><div class="book-shape"></div><div class="cup-shape"></div></div>`
      : `<div class="empty-illo">${icon}</div>`;
    return `<div class="empty-state">${illustration}<h3>${escapeHtml(text)}</h3><p>继续复习或做一组小练习，下一次打开还会记住你的进度。</p></div>`;
  }

  function optionLabel(index) {
    return ["A", "B", "C", "D", "E", "F"][index] || String(index + 1);
  }

  function practiceStreak() {
    const days = new Set((progress.practiceHistory || []).map((entry) => new Date(entry.at).toDateString()));
    return days.size ? Math.min(days.size, 99) : 0;
  }

  function heatmapCells() {
    const history = progress.practiceHistory || [];
    return Array.from({ length: 28 }, (_, index) => {
      const hit = history[history.length - 28 + index];
      const level = hit ? (hit.correct ? 3 : 1) : 0;
      return `<span class="heat-cell level-${level}"></span>`;
    }).join("");
  }

  function categoryClass(category) {
    const index = Math.max(0, categories.indexOf(category));
    return `cat-${(index % 6) + 1}`;
  }

  function brandInitial(item) {
    const text = `${item.term} ${item.definition}`;
    if (/Meta|Facebook|Instagram/i.test(text)) return "∞";
    if (/TikTok|字节|抖音/i.test(text)) return "♪";
    if (/Google|AdMob/i.test(text)) return "G";
    if (/AppLovin|Axon|MAX/i.test(text)) return "A";
    if (/Unity/i.test(text)) return "◼";
    if (/Amazon/i.test(text)) return "AM";
    return item.term.slice(0, 2).toUpperCase();
  }

  function brandClass(item) {
    const text = `${item.term} ${item.definition}`;
    if (/Meta|Facebook|Instagram/i.test(text)) return "brand-meta";
    if (/TikTok|字节|抖音/i.test(text)) return "brand-tiktok";
    if (/Google|AdMob/i.test(text)) return "brand-google";
    if (/AppLovin|Axon|MAX/i.test(text)) return "brand-applovin";
    if (/Unity/i.test(text)) return "brand-unity";
    return "brand-generic";
  }

  function brandMark(item) {
    return `<span class="brand-chip ${brandClass(item)}">${escapeHtml(brandInitial(item))}</span>`;
  }

  function termDisplayName(item) {
    if (isProperNoun(item.term)) return item.term;
    const cn = normalizeChineseTitle(item.term);
    const en = englishTitleFor(item);
    if (!en || cn.toLowerCase() === en.toLowerCase()) return item.term;
    return `${cn} (${en})`;
  }

  function isProperNoun(term) {
    if (properNouns.has(term)) return true;
    return /^(Meta|TikTok|AppLovin|Google|Amazon|Unity|Zapier|LeadsBridge|DealerSocket|Redtail)\b/i.test(term);
  }

  function normalizeChineseTitle(term) {
    return term
      .replace(/（[A-Za-z][^）]*）/g, "")
      .replace(/\([A-Za-z][^)]*\)/g, "")
      .trim();
  }

  function englishTitleFor(item) {
    if (termTranslations[item.term]) return termTranslations[item.term];
    const paren = item.term.match(/[（(]([A-Za-z][A-Za-z0-9 /+\-.&]+)[）)]/);
    if (paren) return paren[1].trim();
    const definitionLead = item.definition.match(/^([A-Za-z][A-Za-z0-9 /+\-.&]{2,80})[，,：:]/);
    if (definitionLead && /[\u4e00-\u9fff]/.test(item.term)) return definitionLead[1].trim();
    return "";
  }

  function shuffle(list) {
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function hashCode(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function normalizeAnswer(value) {
    return String(value).toLowerCase().replace(/\s+/g, "").replace(/[（）()，,。.;；:：-]/g, "");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function switchView(view) {
    state.view = view;
    if (view === "flashcards") {
      state.flashQueue = buildFlashQueue();
      state.flashIndex = 0;
      state.flashAnswerVisible = false;
    }
    if (view === "practice" && !state.quizQueue.length) {
      state.quizQueue = buildQuizQueue(state.practiceCategory);
      state.quizIndex = 0;
      state.selectedAnswer = "";
      state.fillAnswer = "";
      state.submitted = null;
    }
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest(".nav-item");
    if (nav) {
      if (nav.dataset.view === "practice") {
        state.quizQueue = [];
      }
      switchView(nav.dataset.view);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id, level, answer } = button.dataset;
    if (action === "open-library") switchView("library");
    if (action === "open-mistakes") switchView("mistakes");
    if (action === "start-flash") switchView("flashcards");
    if (action === "start-practice") {
      state.quizQueue = [];
      switchView("practice");
    }
    if (action === "detail") {
      state.detailId = id;
      switchView("detail");
    }
    if (action === "back-library") switchView("library");
    if (action === "set-mastery") setMastery(id, level);
    if (action === "practice-item") {
      state.practiceCategory = "all";
      state.quizQueue = buildQuizQueue("all", [id]);
      state.quizIndex = 0;
      state.selectedAnswer = "";
      state.fillAnswer = "";
      state.submitted = null;
      switchView("practice");
    }
    if (action === "toggle-flash") {
      state.flashAnswerVisible = !state.flashAnswerVisible;
      renderFlashcards();
    }
    if (action === "flash-rate") {
      progress.masteryByTermId[id] = Number(level);
      saveJson(storageKeys.progress, progress);
      state.flashIndex += 1;
      state.flashAnswerVisible = false;
      if (state.flashIndex >= state.flashQueue.length) {
        state.flashQueue = buildFlashQueue();
        state.flashIndex = 0;
      }
      renderFlashcards();
    }
    if (action === "restart-quiz") {
      state.quizQueue = buildQuizQueue(state.practiceCategory);
      state.quizIndex = 0;
      state.selectedAnswer = "";
      state.fillAnswer = "";
      state.submitted = null;
      renderPractice();
    }
    if (action === "choose-answer") {
      if (state.submitted) return;
      state.selectedAnswer = answer;
      renderPractice();
    }
    if (action === "submit-answer") submitAnswer();
    if (action === "next-question") nextQuestion();
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "searchInput") {
      state.query = event.target.value;
      renderLibrary();
    }
    if (event.target.id === "fillAnswer") {
      state.fillAnswer = event.target.value;
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "categoryFilter") {
      state.category = event.target.value;
      renderLibrary();
    }
    if (event.target.id === "masteryFilter") {
      state.mastery = event.target.value;
      renderLibrary();
    }
    if (event.target.id === "practiceCategory") {
      state.practiceCategory = event.target.value;
      settings.lastCategory = state.practiceCategory;
      saveJson(storageKeys.settings, settings);
      state.quizQueue = buildQuizQueue(state.practiceCategory);
      state.quizIndex = 0;
      state.selectedAnswer = "";
      state.fillAnswer = "";
      state.submitted = null;
      renderPractice();
    }
  });

  document.querySelector("#resetFiltersBtn").addEventListener("click", () => {
    state.query = "";
    state.category = "all";
    state.mastery = "all";
    renderLibrary();
  });

  document.querySelector("#resetProgressBtn").addEventListener("click", resetProgress);

  function resetProgress() {
    if (!confirm("确定要清空掌握度、练习历史和错题本吗？")) return;
    localStorage.removeItem(storageKeys.progress);
    localStorage.removeItem(storageKeys.wrongQuestions);
    progress.masteryByTermId = {};
    progress.practiceHistory = [];
    Object.keys(wrongQuestions).forEach((key) => delete wrongQuestions[key]);
    state.quizQueue = [];
    state.flashQueue = [];
    render();
  }

  render();
}());
