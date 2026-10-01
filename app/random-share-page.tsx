"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Status = "wishlist" | "planned" | "done";
type Person = "태환" | "선영" | "함께";
type ExpensePerson = "태환" | "선영";
type RandomKind = "date" | "drink" | "food";

type RandomItem = {
  id: string;
  kind: "drink" | "food";
  name: string;
  emoji: string;
  weight: number;
  created_at: string;
};

type SharedRandomResult = {
  id: string;
  kind: RandomKind;
  title: string;
  detail: string;
  picked_by: Person;
  created_at: string;
};

type DateIdea = {
  id: string;
  title: string;
  category: string;
  place: string;
  planned_date: string | null;
  budget: number | null;
  memo: string;
  status: Status;
  favorite: boolean;
  created_by: Person;
  photo_urls: string[];
  created_at: string;
  updated_at?: string;
};

const CATEGORIES = ["맛집", "카페", "여행", "캠핑", "액티비티", "영화", "기타"] as const;
const STATUS_LABEL: Record<Status, string> = {
  wishlist: "가고 싶어요",
  planned: "예정",
  done: "다녀왔어요",
};
const CATEGORY_ICON: Record<string, string> = {
  맛집: "🍽️",
  카페: "☕",
  여행: "✈️",
  캠핑: "🏕️",
  액티비티: "🎯",
  영화: "🎬",
  기타: "💫",
};

const BUDGET_APP_URL = process.env.NEXT_PUBLIC_BUDGET_APP_URL || "https://couple-budget-d3pk.vercel.app/";

const DEFAULT_DRINKS = [
  { name: "소주", weight: 40, emoji: "🍶" },
  { name: "맥주", weight: 25, emoji: "🍺" },
  { name: "와인", weight: 25, emoji: "🍷" },
  { name: "양주", weight: 5, emoji: "🥃" },
  { name: "사케", weight: 5, emoji: "🍶" },
] as const;

const DEFAULT_FOODS = [
  "김치찌개",
  "된장찌개",
  "부대찌개",
  "미역국",
  "소고기무국",
  "계란말이",
  "계란후라이",
  "간계밥",
  "참치마요 덮밥",
  "김치볶음밥",
  "계란 볶음밥",
  "수육",
  "족발",
  "보쌈",
  "치킨",
  "라면",
  "스테이크",
  "스파게티",
  "삼겹살",
  "오리고기",
  "국밥",
  "닭갈비",
  "등갈비",
  "냉면",
  "만두",
  "칼국수",
  "돈까스",
  "햄버거",
  "피자",
] as const;

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function todayString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDate(date: string | null) {
  if (!date) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function dateLabel(status: Status) {
  if (status === "wishlist") return "가고 싶은 날짜";
  if (status === "done") return "다녀온 날짜";
  return "예정 날짜";
}

function googleMapsUrl(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

function formatSharedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function randomKindLabel(kind: RandomKind) {
  if (kind === "date") return "뭐 하지";
  if (kind === "drink") return "뭐 마시지";
  return "뭐 먹지";
}

function randomKindEmoji(kind: RandomKind) {
  if (kind === "date") return "🎲";
  if (kind === "drink") return "🍻";
  return "🍽️";
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "list" | "random" | "add">("home");
  const [ideas, setIdeas] = useState<DateIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [randomPick, setRandomPick] = useState<DateIdea | null>(null);
  const [drinkPick, setDrinkPick] = useState<{ name: string; weight: number; emoji: string } | null>(null);
  const [foodPick, setFoodPick] = useState<string | null>(null);
  const [randomItems, setRandomItems] = useState<RandomItem[]>([]);
  const [sharedRandoms, setSharedRandoms] = useState<SharedRandomResult[]>([]);
  const [randomUser, setRandomUser] = useState<Person>("함께");
  const [newDrink, setNewDrink] = useState("");
  const [newFood, setNewFood] = useState("");
  const [randomActionLoading, setRandomActionLoading] = useState(false);
  const [sharedLink, setSharedLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [expenseDrafts, setExpenseDrafts] = useState<Record<string, { amount: string; person: ExpensePerson; date: string }>>({});

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("맛집");
  const [place, setPlace] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [budget, setBudget] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<Status>("wishlist");
  const [createdBy, setCreatedBy] = useState<Person>("함께");
  const [favorite, setFavorite] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        const config = await response.json();
        if (cancelled) return;
        setCloudEnabled(Boolean(config.cloudEnabled));
        setPinRequired(Boolean(config.requiresPin));

        if (!config.cloudEnabled) {
          setIdeas([]);
          setLoading(false);
          return;
        }

        const storedPin = localStorage.getItem("couple-hub-pin") || "";
        if (!config.requiresPin || storedPin) {
          setPin(storedPin);
        } else {
          setLoading(false);
        }
      } catch {
        setIdeas([]);
        setCloudEnabled(false);
        setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("couple-hub-random-user");
    if (stored === "태환" || stored === "선영" || stored === "함께") setRandomUser(stored);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("url") || (params.get("text") || "").match(/https?:\/\/\S+/)?.[0] || "";
    if (!sharedUrl) return;
    const sharedText = params.get("text") || "";
    const timer = window.setTimeout(() => {
      setActiveTab("add");
      setSharedLink(sharedUrl);
      void loadLinkInfo(sharedUrl, sharedText);
      window.history.replaceState({}, "", window.location.pathname);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cloudEnabled) return;
    if (pinRequired && !pin) return;
    void Promise.all([loadCloud(pin), loadRandomData(pin)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudEnabled, pinRequired, pin]);

  useEffect(() => {
    if (!cloudEnabled) return;
    if (pinRequired && !pin) return;
    const refresh = () => void Promise.all([loadCloud(pin, true), loadRandomData(pin, true)]);
    const timer = window.setInterval(refresh, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudEnabled, pinRequired, pin]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  async function loadCloud(value = pin, silent = false) {
    if (!silent) setLoading(true);
    setPinError("");
    try {
      const response = await fetch("/api/dates", {
        headers: value ? { "x-couple-pin": value } : {},
        cache: "no-store",
      });
      if (response.status === 401) {
        setPinError("PIN이 맞지 않아. 다시 입력해줘.");
        setPin("");
        localStorage.removeItem("couple-hub-pin");
        return;
      }
      if (!response.ok) throw new Error("load_failed");
      const data = (await response.json()) as DateIdea[];
      setIdeas(data);
    } catch {
      setNotice("데이터를 불러오지 못했어. 잠시 후 다시 시도해줘.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function submitPin(event: FormEvent) {
    event.preventDefault();
    const value = pinInput.trim();
    if (!value) return;
    setPinError("");
    try {
      const response = await fetch("/api/dates", {
        headers: { "x-couple-pin": value },
        cache: "no-store",
      });
      if (!response.ok) {
        setPinError("PIN이 맞지 않아.");
        return;
      }
      const data = (await response.json()) as DateIdea[];
      localStorage.setItem("couple-hub-pin", value);
      setPin(value);
      setIdeas(data);
      setPinInput("");
      setLoading(false);
    } catch {
      setPinError("연결에 문제가 있어. 다시 시도해줘.");
    }
  }

  async function loadRandomData(value = pin, silent = false) {
    try {
      const response = await fetch("/api/random", {
        headers: value ? { "x-couple-pin": value } : {},
        cache: "no-store",
      });
      if (response.status === 401) return;
      if (!response.ok) throw new Error("random_load_failed");
      const data = (await response.json()) as { items?: RandomItem[]; results?: SharedRandomResult[] };
      setRandomItems(Array.isArray(data.items) ? data.items : []);
      setSharedRandoms(Array.isArray(data.results) ? data.results : []);
    } catch {
      if (!silent) setNotice("랜덤 공유 데이터를 불러오지 못했어.");
    }
  }

  async function uploadPhotos(files: File[]) {
    if (!files.length) return [] as string[];
    if (!cloudEnabled) throw new Error("cloud_required");

    const form = new FormData();
    files.forEach((file) => form.append("photos", file));
    const response = await fetch("/api/photos", {
      method: "POST",
      headers: pin ? { "x-couple-pin": pin } : {},
      body: form,
    });
    if (!response.ok) throw new Error("photo_upload_failed");
    const data = await response.json();
    return data.urls as string[];
  }

  async function loadLinkInfo(value = sharedLink, sharedText = "") {
    const url = value.trim();
    if (!url) {
      setNotice("인스타·페이스북·지도 링크를 붙여넣어줘.");
      return;
    }
    setLinkLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, text: sharedText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error("preview_failed");
      if (data.name && !title.trim()) setTitle(data.name);
      if (data.address && !place.trim()) setPlace(data.address);
      if (!memo.trim()) setMemo(`출처: ${data.finalUrl || url}`);
      if (data.address) setNotice("장소 이름과 주소를 불러왔어 ✨");
      else if (data.name) setNotice("장소 이름은 찾았어. 주소는 게시물에서 확인되지 않았어.");
      else setNotice("링크는 저장했어. 인스타·페이스북이 정보를 숨긴 경우 이름/주소는 직접 적어줘.");
    } catch {
      setNotice("이 링크에서는 장소 정보를 자동으로 읽지 못했어. 이름과 주소를 직접 적어줘.");
    } finally {
      setLinkLoading(false);
    }
  }

  const drinkOptions = useMemo(() => [
    ...DEFAULT_DRINKS.map((drink) => ({ ...drink })),
    ...randomItems.filter((item) => item.kind === "drink").map((item) => ({
      name: item.name,
      weight: item.weight || 10,
      emoji: item.emoji || "🥂",
    })),
  ], [randomItems]);

  const foodOptions = useMemo(() => {
    const names = [...DEFAULT_FOODS, ...randomItems.filter((item) => item.kind === "food").map((item) => item.name)];
    return Array.from(new Set(names));
  }, [randomItems]);

  function spinDrink() {
    const total = drinkOptions.reduce((sum, drink) => sum + Math.max(1, drink.weight), 0);
    let roll = Math.random() * total;
    const picked = drinkOptions.find((drink) => {
      roll -= Math.max(1, drink.weight);
      return roll < 0;
    }) || drinkOptions[0];
    setDrinkPick(picked);
  }

  function spinFood() {
    setFoodPick(foodOptions[Math.floor(Math.random() * foodOptions.length)] || null);
  }

  function changeRandomUser(person: Person) {
    setRandomUser(person);
    localStorage.setItem("couple-hub-random-user", person);
  }

  async function shareRandomResult(kind: RandomKind, title: string, detail = "") {
    if (!title.trim()) return;
    setRandomActionLoading(true);
    try {
      const response = await fetch("/api/random", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pin ? { "x-couple-pin": pin } : {}),
        },
        body: JSON.stringify({
          action: "share",
          kind,
          title: title.trim(),
          detail: detail.trim(),
          picked_by: randomUser,
        }),
      });
      if (!response.ok) throw new Error("share_failed");
      const rows = (await response.json()) as SharedRandomResult[];
      if (rows[0]) setSharedRandoms((current) => [rows[0], ...current.filter((item) => item.id !== rows[0].id)].slice(0, 12));
      setNotice(`공유했어 💌 ${randomUser === "함께" ? "둘의" : `${randomUser}의`} 결과가 상대방 화면에도 보여.`);
    } catch {
      setNotice("랜덤 결과를 공유하지 못했어. 잠시 후 다시 해줘.");
    } finally {
      setRandomActionLoading(false);
    }
  }

  async function addRandomItem(kind: "drink" | "food") {
    const value = (kind === "drink" ? newDrink : newFood).trim();
    if (!value) return;
    const existingNames = kind === "drink" ? drinkOptions.map((item) => item.name) : foodOptions;
    if (existingNames.some((name) => name.toLowerCase() === value.toLowerCase())) {
      setNotice("이미 들어있는 메뉴야.");
      return;
    }
    setRandomActionLoading(true);
    try {
      const response = await fetch("/api/random", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pin ? { "x-couple-pin": pin } : {}),
        },
        body: JSON.stringify({
          action: "item",
          kind,
          name: value,
          emoji: kind === "drink" ? "🥂" : "😋",
          weight: kind === "drink" ? 10 : 1,
        }),
      });
      if (!response.ok) throw new Error("item_add_failed");
      const rows = (await response.json()) as RandomItem[];
      if (rows[0]) setRandomItems((current) => [...current, rows[0]]);
      if (kind === "drink") setNewDrink("");
      else setNewFood("");
      setNotice(`${value} 추가했어 ✨ 상대방 랜덤 메뉴에도 같이 들어가.`);
    } catch {
      setNotice("메뉴를 추가하지 못했어.");
    } finally {
      setRandomActionLoading(false);
    }
  }

  async function deleteRandomItem(item: RandomItem) {
    if (!window.confirm(`${item.name}을(를) 랜덤 메뉴에서 지울까?`)) return;
    const previous = randomItems;
    setRandomItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    try {
      const response = await fetch(`/api/random?itemId=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: pin ? { "x-couple-pin": pin } : {},
      });
      if (!response.ok) throw new Error("item_delete_failed");
    } catch {
      setRandomItems(previous);
      setNotice("메뉴를 삭제하지 못했어.");
    }
  }

  function expenseDraftFor(idea: DateIdea) {
    return expenseDrafts[idea.id] || {
      amount: idea.budget ? String(idea.budget) : "",
      person: "태환" as ExpensePerson,
      date: idea.planned_date || todayString(),
    };
  }

  function updateExpenseDraft(idea: DateIdea, changes: Partial<{ amount: string; person: ExpensePerson; date: string }>) {
    setExpenseDrafts((current) => ({
      ...current,
      [idea.id]: { ...expenseDraftFor(idea), ...changes },
    }));
  }

  function sendExpenseToBudget(idea: DateIdea) {
    const draft = expenseDraftFor(idea);
    const amount = Number(draft.amount);
    if (!amount || amount <= 0) {
      setNotice("가계부에 보낼 실제 사용 금액을 입력해줘.");
      return;
    }
    const target = new URL(BUDGET_APP_URL);
    target.searchParams.set("from", "couple-hub");
    target.searchParams.set("transfer_id", crypto.randomUUID());
    target.searchParams.set("amount", String(amount));
    target.searchParams.set("date", draft.date || todayString());
    target.searchParams.set("person", draft.person);
    target.searchParams.set("category", "데이트");
    target.searchParams.set("memo", `데이트: ${idea.title}${idea.place ? ` · ${idea.place}` : ""}`);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
    setNotice("가계부를 열었어. 지출이 자동으로 추가돼.");
  }

  function resetForm() {
    setTitle("");
    setCategory("맛집");
    setPlace("");
    setPlannedDate("");
    setBudget("");
    setMemo("");
    setStatus("wishlist");
    setCreatedBy("함께");
    setFavorite(false);
    setSharedLink("");
    setPhotos([]);
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoPreviews([]);
    setEditingId(null);
    setExistingPhotoUrls([]);
  }

  function openAddForm() {
    resetForm();
    setNotice("");
    setActiveTab("add");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(idea: DateIdea) {
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setEditingId(idea.id);
    setTitle(idea.title);
    setCategory(idea.category as (typeof CATEGORIES)[number]);
    setPlace(idea.place);
    setPlannedDate(idea.planned_date || "");
    setBudget(idea.budget !== null ? String(idea.budget) : "");
    setMemo(idea.memo);
    setStatus(idea.status);
    setCreatedBy(idea.created_by);
    setFavorite(idea.favorite);
    setExistingPhotoUrls(idea.photo_urls || []);
    setPhotos([]);
    setPhotoPreviews([]);
    setSharedLink("");
    setNotice("");
    setActiveTab("add");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addIdea(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setNotice("데이트 이름을 먼저 적어줘.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const uploadedPhotoUrls = photos.length ? await uploadPhotos(photos) : [];
      const photoUrls = photos.length ? uploadedPhotoUrls : existingPhotoUrls;
      const payload = {
        title: title.trim(),
        category,
        place: place.trim(),
        planned_date: plannedDate || null,
        budget: budget ? Number(budget) : null,
        memo: memo.trim(),
        status,
        favorite,
        created_by: createdBy,
        photo_urls: photoUrls,
      };

      if (!cloudEnabled) throw new Error("cloud_required");

      if (editingId) {
        const response = await fetch(`/api/dates?id=${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(pin ? { "x-couple-pin": pin } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("save_failed");
        const rows = (await response.json()) as DateIdea[];
        const updated = rows[0];
        if (updated) {
          setIdeas((current) => current.map((idea) => (idea.id === editingId ? updated : idea)));
        } else {
          await loadCloud(pin, true);
        }
        resetForm();
        setNotice("수정했어 ✨");
      } else {
        const response = await fetch("/api/dates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(pin ? { "x-couple-pin": pin } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("save_failed");
        const rows = (await response.json()) as DateIdea[];
        setIdeas((current) => [...rows, ...current]);
        resetForm();
        setNotice("저장했어 💕");
      }
      setActiveTab("list");
    } catch {
      setNotice("저장 중 문제가 생겼어. 사진 크기나 인터넷 연결을 확인해줘.");
    } finally {
      setSaving(false);
    }
  }

  async function patchIdea(id: string, changes: Partial<DateIdea>) {
    const previous = ideas;
    const next = ideas.map((idea) => (idea.id === id ? { ...idea, ...changes } : idea));
    setIdeas(next);
    if (!cloudEnabled) {
      setIdeas(previous);
      setNotice("공유 저장소 연결이 필요해.");
      return;
    }

    try {
      const response = await fetch(`/api/dates?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(pin ? { "x-couple-pin": pin } : {}),
        },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error("patch_failed");
    } catch {
      setIdeas(previous);
      setNotice("변경사항을 저장하지 못했어.");
    }
  }

  async function deleteIdea(id: string) {
    if (!window.confirm("이 데이트 기록을 삭제할까?")) return;
    const previous = ideas;
    const next = ideas.filter((idea) => idea.id !== id);
    setIdeas(next);
    if (!cloudEnabled) {
      setIdeas(previous);
      setNotice("공유 저장소 연결이 필요해.");
      return;
    }
    try {
      const response = await fetch(`/api/dates?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: pin ? { "x-couple-pin": pin } : {},
      });
      if (!response.ok) throw new Error("delete_failed");
    } catch {
      setIdeas(previous);
      setNotice("삭제하지 못했어.");
    }
  }

  function choosePhotos(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).slice(0, 4);
    const tooLarge = selected.some((file) => file.size > 5 * 1024 * 1024);
    if (tooLarge) {
      setNotice("사진 한 장은 5MB 이하로 올려줘.");
      return;
    }
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotos(selected);
    setPhotoPreviews(selected.map((file) => URL.createObjectURL(file)));
  }

  const filteredIdeas = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ideas.filter((idea) => {
      const searchMatch =
        !needle ||
        [idea.title, idea.place, idea.memo, idea.category, idea.created_by]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      const categoryMatch = categoryFilter === "전체" || idea.category === categoryFilter;
      const statusMatch = statusFilter === "all" || idea.status === statusFilter;
      return searchMatch && categoryMatch && statusMatch;
    });
  }, [ideas, query, categoryFilter, statusFilter]);

  const nextDate = useMemo(() => {
    const today = todayString();
    return ideas
      .filter((idea) => idea.status === "planned" && idea.planned_date && idea.planned_date >= today)
      .sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)))[0];
  }, [ideas]);

  const completedCount = ideas.filter((idea) => idea.status === "done").length;
  const wishlistCount = ideas.filter((idea) => idea.status === "wishlist").length;
  const favoriteCount = ideas.filter((idea) => idea.favorite).length;

  function spinRandom() {
    const candidates = ideas.filter((idea) => idea.status !== "done");
    if (!candidates.length) {
      setRandomPick(null);
      setNotice("아직 랜덤으로 뽑을 데이트가 없어. 먼저 하나 추가해줘!");
      return;
    }
    const weighted = candidates.flatMap((idea) => (idea.favorite ? [idea, idea, idea] : [idea]));
    setRandomPick(weighted[Math.floor(Math.random() * weighted.length)]);
  }

  if (!loading && !cloudEnabled) {
    return (
      <main className="pin-page">
        <section className="pin-card">
          <div className="brand-heart">♥</div>
          <p className="eyebrow">TAEHWAN & SUNYOUNG</p>
          <h1>둘이 같이 쓰는 커플 허브</h1>
          <p className="muted">이 버전은 한 폰에 따로 저장하지 않아. Supabase 공용 저장소를 한 번만 연결하면 태환·선영이 같은 링크에서 같은 데이트·사진을 함께 보게 돼.</p>
          <p className="error-text">Vercel에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COUPLE_CODE를 등록한 뒤 다시 배포해줘.</p>
        </section>
      </main>
    );
  }

  if (cloudEnabled && pinRequired && !pin) {
    return (
      <main className="pin-page">
        <section className="pin-card">
          <div className="brand-heart">♥</div>
          <p className="eyebrow">TAEHWAN & SUNYOUNG</p>
          <h1>우리 둘만의 커플 허브</h1>
          <p className="muted">둘이 정한 PIN을 입력하면 같은 데이트 리스트를 함께 볼 수 있어.</p>
          <form onSubmit={submitPin} className="pin-form">
            <input
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN 입력"
              aria-label="커플 PIN"
            />
            <button type="submit">들어가기</button>
          </form>
          {pinError && <p className="error-text">{pinError}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">OUR LITTLE PLACE</p>
          <h1>태환 <span>♥</span> 선영</h1>
        </div>
        <button className="sync-pill" onClick={() => void loadCloud()} type="button">
          <span className="sync-dot cloud" />
          둘이 같이 저장
        </button>
      </header>

      {notice && (
        <button className="notice" onClick={() => setNotice("")} type="button">
          {notice} <span>×</span>
        </button>
      )}

      {loading ? (
        <section className="loading-card">데이트 기록 불러오는 중… 💕</section>
      ) : (
        <>
          {activeTab === "home" && (
            <section className="page-section home-section">
              <div className="hero-card">
                <div>
                  <p className="hero-kicker">NEXT DATE</p>
                  {nextDate ? (
                    <>
                      <h2>{nextDate.title}</h2>
                      <p className="hero-meta">
                        {CATEGORY_ICON[nextDate.category]} {nextDate.category}
                        {nextDate.place ? ` · ${nextDate.place}` : ""}
                      </p>
                      <div className="date-badge">{formatDate(nextDate.planned_date)}</div>
                    </>
                  ) : (
                    <>
                      <h2>다음 데이트를 정해볼까?</h2>
                      <p className="hero-meta">가고 싶은 곳을 추가하고 날짜를 잡아보자.</p>
                      <button className="soft-button" onClick={openAddForm} type="button">
                        데이트 추가하기
                      </button>
                    </>
                  )}
                </div>
                <div className="hero-emoji">💞</div>
              </div>

              <div className="stats-grid">
                <article className="stat-card"><strong>{ideas.length}</strong><span>전체 데이트</span></article>
                <article className="stat-card"><strong>{wishlistCount}</strong><span>가고 싶은 곳</span></article>
                <article className="stat-card"><strong>{completedCount}</strong><span>함께한 추억</span></article>
                <article className="stat-card"><strong>{favoriteCount}</strong><span>즐겨찾기</span></article>
              </div>

              <div className="section-heading">
                <div><p className="eyebrow">FAVORITES</p><h2>우리의 찜 목록</h2></div>
                <button onClick={() => setActiveTab("list")} type="button">전체 보기</button>
              </div>
              <div className="mini-list">
                {ideas.filter((idea) => idea.favorite).slice(0, 3).map((idea) => (
                  <button className="mini-card" key={idea.id} onClick={() => setActiveTab("list")} type="button">
                    {idea.photo_urls[0] ? <img src={idea.photo_urls[0]} alt="" /> : <div className="mini-placeholder">{CATEGORY_ICON[idea.category]}</div>}
                    <div><strong>{idea.title}</strong><span>{idea.place || idea.category}</span></div>
                    <span className="mini-arrow">›</span>
                  </button>
                ))}
                {!ideas.some((idea) => idea.favorite) && (
                  <div className="empty-card">마음에 드는 데이트에 ⭐를 눌러두면 여기 모여.</div>
                )}
              </div>
            </section>
          )}

          {activeTab === "list" && (
            <section className="page-section">
              <div className="section-heading list-title">
                <div><p className="eyebrow">DATE LIST</p><h2>우리 데이트 리스트</h2></div>
                <button className="round-add" onClick={openAddForm} type="button">＋</button>
              </div>

              <input
                className="search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="데이트, 장소, 메모 검색"
              />
              <div className="chip-row">
                {["전체", ...CATEGORIES].map((item) => (
                  <button
                    key={item}
                    className={categoryFilter === item ? "chip active" : "chip"}
                    onClick={() => setCategoryFilter(item)}
                    type="button"
                  >
                    {item === "전체" ? "전체" : `${CATEGORY_ICON[item]} ${item}`}
                  </button>
                ))}
              </div>
              <div className="segmented">
                {(["all", "wishlist", "planned", "done"] as const).map((item) => (
                  <button
                    key={item}
                    className={statusFilter === item ? "active" : ""}
                    onClick={() => setStatusFilter(item)}
                    type="button"
                  >
                    {item === "all" ? "전체" : STATUS_LABEL[item]}
                  </button>
                ))}
              </div>

              <div className="date-grid">
                {filteredIdeas.map((idea) => (
                  <article className="date-card" key={idea.id}>
                    <div className="photo-strip">
                      {idea.photo_urls.length ? (
                        idea.photo_urls.slice(0, 3).map((url, index) => (
                          <img key={`${url}-${index}`} src={url} alt={`${idea.title} 사진 ${index + 1}`} />
                        ))
                      ) : (
                        <div className="card-photo-placeholder">{CATEGORY_ICON[idea.category]}</div>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-topline">
                        <span className="category-label">{CATEGORY_ICON[idea.category]} {idea.category}</span>
                        <button
                          className={idea.favorite ? "favorite active" : "favorite"}
                          onClick={() => patchIdea(idea.id, { favorite: !idea.favorite })}
                          type="button"
                          aria-label="즐겨찾기"
                        >
                          ★
                        </button>
                      </div>
                      <h3>{idea.title}</h3>
                      <p className="card-meta">
                        {idea.place ? (
                          <a className="map-link" href={googleMapsUrl(idea.place)} target="_blank" rel="noreferrer">
                            📍 {idea.place} · Google 지도 보기
                          </a>
                        ) : (
                          "장소 미정"
                        )}
                        <span className="date-meta"> · {dateLabel(idea.status)}: {formatDate(idea.planned_date)}</span>
                      </p>
                      {idea.memo && <p className="card-memo">{idea.memo}</p>}
                      <div className="card-bottom card-bottom-editable">
                        <select
                          value={idea.status}
                          onChange={(event) => patchIdea(idea.id, { status: event.target.value as Status })}
                          aria-label="데이트 상태"
                        >
                          <option value="wishlist">💗 가고 싶어요</option>
                          <option value="planned">📅 예정</option>
                          <option value="done">✨ 다녀왔어요</option>
                        </select>
                        <label className="inline-date-field">
                          <span>{dateLabel(idea.status)}</span>
                          <input
                            type="date"
                            value={idea.planned_date || ""}
                            onChange={(event) => patchIdea(idea.id, { planned_date: event.target.value || null })}
                            aria-label={dateLabel(idea.status)}
                          />
                        </label>
                        <div className="card-small-info">
                          {idea.budget !== null && <span>{currency.format(idea.budget)}</span>}
                          <span>{idea.created_by}</span>
                        </div>
                      </div>
                      <div className="budget-sync-box">
                        <strong>💸 실제로 쓴 비용</strong>
                        <div className="budget-sync-grid">
                          <input
                            type="number"
                            min="0"
                            inputMode="decimal"
                            value={expenseDraftFor(idea).amount}
                            onChange={(event) => updateExpenseDraft(idea, { amount: event.target.value })}
                            placeholder="예: 120"
                            aria-label="실제 사용 비용"
                          />
                          <input
                            type="date"
                            value={expenseDraftFor(idea).date}
                            onChange={(event) => updateExpenseDraft(idea, { date: event.target.value })}
                            aria-label="지출 날짜"
                          />
                        </div>
                        <div className="payer-row">
                          {(["태환", "선영"] as ExpensePerson[]).map((person) => (
                            <button
                              key={person}
                              type="button"
                              className={expenseDraftFor(idea).person === person ? "payer active" : "payer"}
                              onClick={() => updateExpenseDraft(idea, { person })}
                            >
                              {person}
                            </button>
                          ))}
                          <button className="budget-send" type="button" onClick={() => sendExpenseToBudget(idea)}>
                            가계부에 보내기 →
                          </button>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button className="edit-link" onClick={() => startEdit(idea)} type="button">✏️ 수정</button>
                        <button className="delete-link" onClick={() => deleteIdea(idea.id)} type="button">삭제</button>
                      </div>
                    </div>
                  </article>
                ))}
                {!filteredIdeas.length && <div className="empty-card">조건에 맞는 데이트가 없어.</div>}
              </div>
            </section>
          )}

          {activeTab === "random" && (
            <section className="page-section random-page">
              <div className="random-orbit"><span>?</span></div>
              <p className="eyebrow">PICK FOR US</p>
              <h2>오늘 뭐 하지?</h2>
              <p className="muted centered">뽑은 결과를 둘에게 공유하면 태환·선영 화면에 같이 남아.</p>

              <div className="random-user-box">
                <span>지금 돌리는 사람</span>
                <div className="random-user-buttons">
                  {(["태환", "선영", "함께"] as Person[]).map((person) => (
                    <button
                      key={person}
                      className={randomUser === person ? "active" : ""}
                      onClick={() => changeRandomUser(person)}
                      type="button"
                    >
                      {person}
                    </button>
                  ))}
                </div>
              </div>

              {!!sharedRandoms.length && (
                <div className="shared-random-board">
                  <div className="shared-random-heading">
                    <div>
                      <p className="eyebrow">SHARED PICKS</p>
                      <h3>둘이 공유한 최근 결과 💌</h3>
                    </div>
                    <button type="button" onClick={() => void loadRandomData(pin)}>새로고침</button>
                  </div>
                  <div className="shared-random-list">
                    {sharedRandoms.slice(0, 6).map((item) => (
                      <article className="shared-random-item" key={item.id}>
                        <span className="shared-random-emoji">{randomKindEmoji(item.kind)}</span>
                        <div>
                          <small>{item.picked_by} · {randomKindLabel(item.kind)} · {formatSharedTime(item.created_at)}</small>
                          <strong>{item.title}</strong>
                          {item.detail && <p>{item.detail}</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              <button className="primary-big" onClick={spinRandom} type="button">🎲 랜덤 데이트 뽑기</button>

              {randomPick && (
                <article className="random-result">
                  {randomPick.photo_urls[0] && <img src={randomPick.photo_urls[0]} alt={randomPick.title} />}
                  <div>
                    <span className="category-label">{CATEGORY_ICON[randomPick.category]} {randomPick.category}</span>
                    <h3>{randomPick.title}</h3>
                    <p>{randomPick.place || "장소는 둘이 정하기"}</p>
                    {randomPick.memo && <p className="random-memo">{randomPick.memo}</p>}
                    <button
                      className="share-pick-button"
                      onClick={() => void shareRandomResult("date", randomPick.title, randomPick.place || randomPick.memo || "데이트 랜덤 결과")}
                      disabled={randomActionLoading}
                      type="button"
                    >
                      💌 이 결과 둘에게 공유하기
                    </button>
                  </div>
                </article>
              )}
              <p className="tiny-note">⭐ 즐겨찾기한 데이트는 랜덤에서 조금 더 자주 나와.</p>

              <div className="drink-card">
                <p className="eyebrow">DRINK PICK</p>
                <h2>오늘 뭐 마시지? 🍻</h2>
                <p className="muted centered">기본 술은 기존 가중치를 유지하고, 직접 추가한 술은 가중치 10으로 같이 뽑혀.</p>
                <button className="primary-big" onClick={spinDrink} type="button">🎰 술 랜덤 뽑기</button>
                {drinkPick && (
                  <div className="drink-result">
                    <span>{drinkPick.emoji}</span>
                    <strong>{drinkPick.name}</strong>
                    <small>오늘은 이걸로!</small>
                    <button
                      className="share-pick-button"
                      onClick={() => void shareRandomResult("drink", drinkPick.name, "오늘 뭐 마시지 결과")}
                      disabled={randomActionLoading}
                      type="button"
                    >
                      💌 둘에게 공유
                    </button>
                  </div>
                )}

                <div className="custom-menu-box">
                  <strong>＋ 술 메뉴 직접 추가</strong>
                  <div className="custom-menu-form">
                    <input
                      value={newDrink}
                      onChange={(event) => setNewDrink(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addRandomItem("drink"); } }}
                      placeholder="예: 하이볼, 막걸리"
                    />
                    <button type="button" disabled={randomActionLoading} onClick={() => void addRandomItem("drink")}>추가</button>
                  </div>
                  {!!randomItems.filter((item) => item.kind === "drink").length && (
                    <div className="custom-menu-tags">
                      {randomItems.filter((item) => item.kind === "drink").map((item) => (
                        <span key={item.id}>{item.name}<button type="button" onClick={() => void deleteRandomItem(item)}>×</button></span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="food-card">
                <p className="eyebrow">FOOD PICK</p>
                <h2>오늘 뭐 먹지? 🍽️</h2>
                <p className="muted centered">둘이 메뉴 고민될 때 한 번 눌러서 정해보자.</p>
                <button className="primary-big" onClick={spinFood} type="button">🍳 음식 랜덤 뽑기</button>
                {foodPick && (
                  <div className="food-result">
                    <span>😋</span>
                    <strong>{foodPick}</strong>
                    <small>오늘 메뉴 당첨!</small>
                    <button
                      className="share-pick-button"
                      onClick={() => void shareRandomResult("food", foodPick, "오늘 뭐 먹지 결과")}
                      disabled={randomActionLoading}
                      type="button"
                    >
                      💌 둘에게 공유
                    </button>
                  </div>
                )}

                <div className="custom-menu-box">
                  <strong>＋ 음식 메뉴 직접 추가</strong>
                  <div className="custom-menu-form">
                    <input
                      value={newFood}
                      onChange={(event) => setNewFood(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addRandomItem("food"); } }}
                      placeholder="예: 마라탕, 샤브샤브"
                    />
                    <button type="button" disabled={randomActionLoading} onClick={() => void addRandomItem("food")}>추가</button>
                  </div>
                  {!!randomItems.filter((item) => item.kind === "food").length && (
                    <div className="custom-menu-tags">
                      {randomItems.filter((item) => item.kind === "food").map((item) => (
                        <span key={item.id}>{item.name}<button type="button" onClick={() => void deleteRandomItem(item)}>×</button></span>
                      ))}
                    </div>
                  )}
                </div>

                <details className="food-list-details">
                  <summary>들어있는 메뉴 보기 ({foodOptions.length}개)</summary>
                  <p>{foodOptions.join(" · ")}</p>
                </details>
              </div>
            </section>
          )}

          {activeTab === "add" && (
            <section className="page-section form-page">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{editingId ? "EDIT DATE" : "NEW DATE"}</p>
                  <h2>{editingId ? "데이트 수정하기" : "데이트 추가하기"}</h2>
                </div>
                {editingId && <button type="button" onClick={openAddForm}>새로 추가</button>}
              </div>
              <form className="date-form" onSubmit={addIdea}>
                <div className="link-import-box">
                  <div>
                    <strong>🔗 인스타·페이스북 링크로 추가</strong>
                    <small>게시물 링크를 붙여넣으면 가능한 경우 장소 이름과 주소를 자동으로 채워줘.</small>
                  </div>
                  <div className="link-import-row">
                    <input
                      value={sharedLink}
                      onChange={(event) => setSharedLink(event.target.value)}
                      placeholder="https://www.instagram.com/..."
                      inputMode="url"
                    />
                    <button type="button" onClick={() => void loadLinkInfo()} disabled={linkLoading}>
                      {linkLoading ? "불러오는 중…" : "정보 불러오기"}
                    </button>
                  </div>
                </div>

                <label>
                  <span>데이트 이름 *</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 바닷가 캠핑" />
                </label>

                <div>
                  <span className="label-title">카테고리</span>
                  <div className="category-picker">
                    {CATEGORIES.map((item) => (
                      <button
                        key={item}
                        className={category === item ? "category-option active" : "category-option"}
                        onClick={() => setCategory(item)}
                        type="button"
                      >
                        <strong>{CATEGORY_ICON[item]}</strong>
                        <span>{item}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="two-col">
                  <label>
                    <span>장소</span>
                    <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="예: Jervis Bay" />
                    {place.trim() && (
                      <a className="form-map-link" href={googleMapsUrl(place.trim())} target="_blank" rel="noreferrer">📍 Google 지도에서 주소 보기</a>
                    )}
                  </label>
                  <label><span>{dateLabel(status)}</span><input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} /></label>
                </div>
                <div className="two-col">
                  <label><span>예상 비용 (AUD)</span><input type="number" min="0" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="150" /></label>
                  <label>
                    <span>누가 추가했어?</span>
                    <select value={createdBy} onChange={(event) => setCreatedBy(event.target.value as Person)}>
                      <option value="함께">함께</option>
                      <option value="태환">태환</option>
                      <option value="선영">선영</option>
                    </select>
                  </label>
                </div>
                <label>
                  <span>상태</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
                    <option value="wishlist">💗 가고 싶어요</option>
                    <option value="planned">📅 예정</option>
                    <option value="done">✨ 다녀왔어요</option>
                  </select>
                </label>
                <label><span>메모</span><textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="먹고 싶은 메뉴, 준비물, 예약 정보 같은 걸 적어둬." rows={4} /></label>

                <div>
                  <span className="label-title">사진 (최대 4장)</span>
                  {editingId && !!existingPhotoUrls.length && !photoPreviews.length && (
                    <div className="existing-photo-block">
                      <div className="preview-grid">
                        {existingPhotoUrls.map((url, index) => <img src={url} alt={`현재 사진 ${index + 1}`} key={url} />)}
                      </div>
                      <button className="remove-photos-button" type="button" onClick={() => setExistingPhotoUrls([])}>기존 사진 모두 지우기</button>
                    </div>
                  )}
                  <label className="photo-upload">
                    <input type="file" accept="image/*" multiple onChange={(event) => choosePhotos(event.target.files)} />
                    <strong>{editingId ? "＋ 새 사진으로 교체" : "＋ 사진 추가"}</strong>
                    <small>{editingId ? "새 사진을 고르면 기존 사진 대신 저장돼 · 한 장당 5MB 이하" : "한 장당 5MB 이하"}</small>
                  </label>
                  {!!photoPreviews.length && (
                    <div className="preview-grid">
                      {photoPreviews.map((url, index) => <img src={url} alt={`미리보기 ${index + 1}`} key={url} />)}
                    </div>
                  )}
                </div>

                <label className="favorite-check">
                  <input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />
                  <span>⭐ 우리 찜 목록에 바로 넣기</span>
                </label>

                <button className="primary-big" type="submit" disabled={saving}>
                  {saving ? "저장 중…" : editingId ? "수정 내용 저장하기 ✓" : "데이트 저장하기 ♥"}
                </button>
                {editingId && (
                  <button className="cancel-edit-button" type="button" onClick={() => { resetForm(); setActiveTab("list"); }}>수정 취소</button>
                )}
              </form>
            </section>
          )}
        </>
      )}

      <nav className="bottom-nav" aria-label="메인 메뉴">
        <button className={activeTab === "home" ? "active" : ""} onClick={() => setActiveTab("home")} type="button"><span>⌂</span><small>홈</small></button>
        <button className={activeTab === "list" ? "active" : ""} onClick={() => setActiveTab("list")} type="button"><span>♡</span><small>데이트</small></button>
        <button className={activeTab === "random" ? "active" : ""} onClick={() => setActiveTab("random")} type="button"><span>✦</span><small>랜덤</small></button>
        <button className={activeTab === "add" ? "active" : ""} onClick={openAddForm} type="button"><span>＋</span><small>추가</small></button>
      </nav>
    </main>
  );
}
