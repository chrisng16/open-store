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
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  themeConfig: Record<string, unknown> | null;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  isActive: boolean;
  address: string | null;
  phone: string | null;
  timezone: string;
  businessHours: BusinessHours | null;
  createdAt: string;
  updatedAt: string;
};

export type StorePublic = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  themeConfig: Record<string, unknown> | null;
  isActive: boolean;
  address: string | null;
  phone: string | null;
  businessHours: BusinessHours | null;
  timezone: string | null;
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
  nextStepId: string | null;
  activeProductCount: number;
  hasPublishedImport: boolean;
  steps: OnboardingStepStatus[];
};

export type Category = {
    id: string;
    storeId: string;
    name: string;
    description: string | null;
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
    categoryId: string | null;
    name: string;
    description: string | null;
    unitAmount: number;
    currency: string;
    decimalPlaces: number;
    imageUrl: string | null;
    isActive: boolean;
    sortOrder: number;
    dietaryTags: string[] | null;
    allergens: string[] | null;
    ingredients: string | null;
    optionLists: OptionList[];
    createdAt: string;
    updatedAt: string;
};

export type ProductListItem = {
    id: string;
    storeId: string;
    categoryId: string | null;
    name: string;
    description: string | null;
    unitAmount: number;
    currency: string;
    decimalPlaces: number;
    imageUrl: string | null;
    isActive: boolean;
    sortOrder: number;
    dietaryTags: string[] | null;
    allergens: string[] | null;
    ingredients: string | null;
    optionLists: OptionList[];
    createdAt: string;
    updatedAt: string;
};

export type ProductListItemCategory = {
    id: string;
    name: string;
};

export type ProductWithCategoryListItem = ProductListItem & {
    category: ProductListItemCategory | null;
};

export type OrderStatus = "pending" | "paid" | "in_progress" | "ready_for_pickup" | "completed" | "cancelled";

export type OrderItemOption = {
    id: string;
    optionId: string | null;
    optionName: string;
    unitAmount: number;
    quantity: number;
};

export type OrderItem = {
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
    options: OrderItemOption[];
};

export type Order = {
    id: string;
    storeId: string;
    customerId: string | null;
    status: OrderStatus;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    decimalPlaces: number;
    stripePaymentIntentId: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    notes: string | null;
    orderAccessToken: string | null;
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
    categoryName: string | null;
    itemName: string;
    description: string | null;
    unitAmount: number | null;
    optionLists: Record<string, unknown> | null;
    dietaryTags: string[] | null;
    allergens: string[] | null;
    confidence: number;
    status: ImportItemStatus;
    linkedProductId: string | null;
    createdAt: string;
    updatedAt: string;
};

export type MenuImport = {
    id: string;
    storeId: string;
    uploadedBy: string;
    fileUrl: string;
    fileSizeBytes: number | null;
    fileSizeMb: number | null;
    fileType: FileType;
    status: ImportStatus;
    rawExtraction: Record<string, unknown> | null;
    parsedData: Record<string, unknown> | null;
    confidenceScores: Record<string, unknown> | null;
    errorLog: string | null;
    processingStartedAt: string | null;
    ingestedAt: string | null;
    ingestDurationSeconds: number | null;
    processingElapsedSeconds: number | null;
    aiProcessingSeconds: number | null;
    aiSecondsPerMb: number | null;
    aiMbPerSecond: number | null;
    publishedAt: string | null;
    items: MenuImportItem[];
    createdAt: string;
    updatedAt: string;
};

export type PaymentIntent = {
    clientSecret: string;
    paymentIntentId: string;
};
