import type { Locale } from "@kreps/shared";

export type Dictionary = {
  app: {
    productName: string;
    searchPlaceholder: string;
    quickCreate: string;
    notifications: string;
    userMenu: string;
    language: string;
    theme: string;
  };
  nav: {
    myWork: string;
    newWork: string;
    allWork: string;
    projects: string;
    approvals: string;
    organization: string;
    glossary: string;
    settings: string;
  };
  theme: {
    system: string;
    light: string;
    dark: string;
  };
  home: {
    eyebrow: string;
    title: string;
    subtitle: string;
    today: string;
    review: string;
    overdue: string;
    unassigned: string;
    focusTitle: string;
    focusBody: string;
    tableTitle: string;
    columnWork: string;
    columnOwner: string;
    columnStatus: string;
    columnDue: string;
  };
  organizationPage: {
    title: string;
    subtitle: string;
    treeTitle: string;
    usersTitle: string;
    organizationColumn: string;
    codeColumn: string;
    userColumn: string;
    roleColumn: string;
  };
  roles: {
    systemAdmin: string;
    organizationAdmin: string;
    workManager: string;
    employee: string;
  };
  settingsPage: {
    title: string;
    subtitle: string;
    preferencesTitle: string;
    languageLabel: string;
    themeLabel: string;
    previewTitle: string;
    previewBody: string;
  };
  status: {
    registered: string;
    assigned: string;
    inProgress: string;
    reviewNeeded: string;
  };
};

export const dictionaries: Record<Locale, Dictionary> = {
  ko: {
    app: {
      productName: "KREPS Work OS",
      searchPlaceholder: "업무, 프로젝트, 사람 검색",
      quickCreate: "빠른 등록",
      notifications: "알림",
      userMenu: "사용자 메뉴",
      language: "언어",
      theme: "테마",
    },
    nav: {
      myWork: "내 업무",
      newWork: "업무 등록",
      allWork: "전사 업무",
      projects: "프로젝트",
      approvals: "승인",
      organization: "조직",
      glossary: "용어집",
      settings: "설정",
    },
    theme: {
      system: "시스템",
      light: "라이트",
      dark: "다크",
    },
    home: {
      eyebrow: "오늘의 업무 흐름",
      title: "내가 처리해야 할 업무를 먼저 보여줍니다",
      subtitle: "요청, 배정, 검토, 지연 상태를 한 화면에서 확인하고 바로 다음 행동으로 이동합니다.",
      today: "오늘 처리",
      review: "검토 대기",
      overdue: "기한 초과",
      unassigned: "미배정",
      focusTitle: "가장 먼저 볼 것",
      focusBody: "상단 검색과 빠른 등록은 모든 화면에서 유지됩니다. 직원은 내 업무를, 관리자는 미배정과 지연 업무를 바로 확인합니다.",
      tableTitle: "업무 목록 미리보기",
      columnWork: "업무",
      columnOwner: "담당",
      columnStatus: "상태",
      columnDue: "기한",
    },
    organizationPage: {
      title: "조직",
      subtitle: "자유로운 계층형 조직과 사용자 역할을 한 화면에서 확인합니다.",
      treeTitle: "조직도",
      usersTitle: "사용자",
      organizationColumn: "조직",
      codeColumn: "코드",
      userColumn: "사용자",
      roleColumn: "역할",
    },
    roles: {
      systemAdmin: "시스템 관리자",
      organizationAdmin: "조직 관리자",
      workManager: "업무 관리자",
      employee: "직원",
    },
    settingsPage: {
      title: "사용자 설정",
      subtitle: "언어와 테마는 즉시 화면에 반영됩니다.",
      preferencesTitle: "표시 환경",
      languageLabel: "설정 언어",
      themeLabel: "설정 테마",
      previewTitle: "현재 적용 상태",
      previewBody: "이 설정은 개인 업무 화면과 이후 서버 저장 설정에 연결됩니다.",
    },
    status: {
      registered: "등록됨",
      assigned: "배정됨",
      inProgress: "진행 중",
      reviewNeeded: "검토 필요",
    },
  },
  en: {
    app: {
      productName: "KREPS Work OS",
      searchPlaceholder: "Search work, projects, people",
      quickCreate: "Quick Create",
      notifications: "Notifications",
      userMenu: "User menu",
      language: "Language",
      theme: "Theme",
    },
    nav: {
      myWork: "My Work",
      newWork: "New Work",
      allWork: "All Work",
      projects: "Projects",
      approvals: "Approvals",
      organization: "Organization",
      glossary: "Glossary",
      settings: "Settings",
    },
    theme: {
      system: "System",
      light: "Light",
      dark: "Dark",
    },
    home: {
      eyebrow: "Today's work flow",
      title: "Start with the work that needs your attention",
      subtitle: "Requests, assignments, reviews, and overdue work stay visible so the next action is clear.",
      today: "Due today",
      review: "Awaiting review",
      overdue: "Overdue",
      unassigned: "Unassigned",
      focusTitle: "What comes first",
      focusBody: "Search and quick create stay available from every screen. Employees see their own work first; managers see unassigned and overdue work first.",
      tableTitle: "Work list preview",
      columnWork: "Work",
      columnOwner: "Owner",
      columnStatus: "Status",
      columnDue: "Due",
    },
    organizationPage: {
      title: "Organization",
      subtitle: "Review the flexible organization tree and user role assignments in one place.",
      treeTitle: "Organization Tree",
      usersTitle: "Users",
      organizationColumn: "Organization",
      codeColumn: "Code",
      userColumn: "User",
      roleColumn: "Role",
    },
    roles: {
      systemAdmin: "System Admin",
      organizationAdmin: "Organization Admin",
      workManager: "Work Manager",
      employee: "Employee",
    },
    settingsPage: {
      title: "User Settings",
      subtitle: "Language and theme changes apply immediately.",
      preferencesTitle: "Display Preferences",
      languageLabel: "Settings language",
      themeLabel: "Settings theme",
      previewTitle: "Current state",
      previewBody: "These preferences will connect to the saved server profile.",
    },
    status: {
      registered: "Registered",
      assigned: "Assigned",
      inProgress: "In progress",
      reviewNeeded: "Needs review",
    },
  },
};
