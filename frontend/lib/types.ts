export type BusinessHourRange = {
  startMin: number;
  endMin: number;
};

export type BusinessDayHours = {
  status: "open24" | "closed" | "ranges";
  ranges?: BusinessHourRange[];
};

export type BusinessHours = {
  sun: BusinessDayHours;
  mon: BusinessDayHours;
  tue: BusinessDayHours;
  wed: BusinessDayHours;
  thu: BusinessDayHours;
  fri: BusinessDayHours;
  sat: BusinessDayHours;
};

export type Store = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeConfig?: Record<string, unknown>;
  stripeAccountId?: string;
  stripeOnboardingComplete: boolean;
  isActive: boolean;
  address?: string;
  phone?: string;
  timezone: string;
  businessHours?: BusinessHours;
  createdAt: string;
  updatedAt: string;
};

export type StorePublic = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeConfig?: Record<string, unknown>;
  isActive: boolean;
  address?: string;
  phone?: string;
  businessHours?: BusinessHours;
  timezone?: string;
};

export type StoreMember = {
  id: string;
  storeId: string;
  userId: string;
  role: string;
  createdAt: string;
};

export type OnboardingStepStatus = {
  id: string;
  title: string;
  completed: boolean;
  required: boolean;
  blockingReasons: string[];
};

export type StoreOnboardingStatus = {
  storeId: string;
  onboardingComplete: boolean;
  canGoLive: boolean;
  isActive: boolean;
  completedRequiredSteps: number;
  totalRequiredSteps: number;
  nextStepId?: string;
  activeProductCount: number;
  hasPublishedImport: boolean;
  steps: OnboardingStepStatus[];
};

export type Category = {
    id: string;
    storeId: string;
    name: string;
    description?: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export type Option = {
    id: string;
    optionListId: string;
    name: string;
    unitAmount: number;
    currency: string;
    decimalPlaces: number;
    minOptionChoiceQuantity: number;
    maxOptionChoiceQuantity: number;
    defaultQuantity: number;
    isDefault: boolean;
    sortOrder: number;
};

export type OptionList = {
    id: string;
    productId: string;
    name: string;
    selectionNode: string;
    minNumOptions: number;
    maxNumOptions: number;
    minAggregateOptionsQuantity: number;
    maxAggregateOptionsQuantity: number;
    isOptional: boolean;
    sortOrder: number;
    options: Option[];
};

export type Product = {
    id: string;
    storeId: string;
    categoryId?: string;
    name: string;
    description?: string;
    unitAmount: number;
    currency: string;
    decimalPlaces: number;
    imageUrl?: string;
    isActive: boolean;
    sortOrder: number;
    dietaryTags?: string[];
    allergens?: string[];
    ingredients?: string;
    optionLists: OptionList[];
    createdAt: string;
    updatedAt: string;
};

export type ProductListItem = {
    id: string;
    storeId: string;
    categoryId?: string;
    name: string;
    description?: string;
    unitAmount: number;
    currency: string;
    decimalPlaces: number;
    imageUrl?: string;
    isActive: boolean;
    sortOrder: number;
    dietaryTags?: string[];
    allergens?: string[];
    ingredients?: string;
    createdAt: string;
    updatedAt: string;
};

export type ProductListItemCategory = {
    id: string;
    name: string;
};

export type ProductWithCategoryListItem = ProductListItem & {
    category?: ProductListItemCategory;
};

export type OrderStatus = "pending" | "paid" | "in_progress" | "ready_for_pickup" | "completed" | "cancelled";

export type OrderItemOption = {
    id: string;
    optionId?: string;
    optionName: string;
    unitAmount: number;
    quantity: number;
};

export type OrderItem = {
    id: string;
    productId?: string;
    productName: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
    options: OrderItemOption[];
};

export type Order = {
    id: string;
    storeId: string;
    customerId?: string;
    status: OrderStatus;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    decimalPlaces: number;
    stripePaymentIntentId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    notes?: string;
    orderAccessToken?: string;
    displayId: string;
    orderReference: string;
    dailySequence: number;
    items: OrderItem[];
    createdAt: string;
    updatedAt: string;
};

export type ImportStatus = "pending" | "processing" | "completed" | "failed" | "published";
export type ImportItemStatus = "pending" | "mapped" | "ignored";
export type FileType = "application/pdf" | "image/jpeg" | "image/png";

export type MenuImportItem = {
    id: string;
    menuImportId: string;
    categoryName?: string;
    itemName: string;
    description?: string;
    unitAmount?: number;
    optionLists?: Record<string, unknown>;
    dietaryTags?: string[];
    allergens?: string[];
    confidence: number;
    status: ImportItemStatus;
    linkedProductId?: string;
    createdAt: string;
    updatedAt: string;
};

export type MenuImport = {
    id: string;
    storeId: string;
    uploadedBy: string;
    fileUrl: string;
    fileSizeBytes?: number;
    fileSizeMb?: number;
    fileType: FileType;
    status: ImportStatus;
    rawExtraction?: Record<string, unknown>;
    parsedData?: Record<string, unknown>;
    confidenceScores?: Record<string, unknown>;
    errorLog?: string;
    processingStartedAt?: string;
    ingestedAt?: string;
    ingestDurationSeconds?: number;
    processingElapsedSeconds?: number;
    aiProcessingSeconds?: number;
    aiSecondsPerMb?: number;
    aiMbPerSecond?: number;
    publishedAt?: string;
    items: MenuImportItem[];
    createdAt: string;
    updatedAt: string;
};

export type PaymentIntent = {
    clientSecret: string;
    paymentIntentId: string;
};
