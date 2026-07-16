# Service Template

## Purpose

Use this template when creating a new service class. Services contain business logic and orchestrate between repositories, external APIs, and other services.

## When to Use

- Encapsulating business logic
- Coordinating multiple repositories
- Integrating with external services
- Implementing caching strategies
- Handling complex workflows

---

## Complete File Structure

```
services/
  notification-service.ts      # Service implementation
  notification-service.test.ts # Service tests
  interfaces/
    notification-service.ts    # Service interface (for DI)
```

---

## Step-by-Step Process

### 1. Define the Interface

```typescript
// services/interfaces/notification-service.ts
export interface NotificationService {
  sendNotification(input: SendNotificationInput): Promise<Notification>;
  sendBulkNotifications(input: SendBulkNotificationInput): Promise<Notification[]>;
  getNotificationById(id: string): Promise<Notification | null>;
  getUserNotifications(userId: string, options?: GetNotificationsOptions): Promise<PaginatedResult<Notification>>;
  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(userId: string): Promise<number>;
  deleteNotification(id: string): Promise<boolean>;
  getUnreadCount(userId: string): Promise<number>;
}

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: "low" | "medium" | "high";
  channels?: NotificationChannel[];
}

export interface SendBulkNotificationInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: "low" | "medium" | "high";
}

export interface GetNotificationsOptions {
  page?: number;
  limit?: number;
  type?: NotificationType;
  isRead?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export type NotificationType =
  | "info"
  | "warning"
  | "error"
  | "success"
  | "mention"
  | "assignment"
  | "reminder";

export type NotificationChannel = "in_app" | "email" | "push" | "sms";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority: "low" | "medium" | "high";
  isRead: boolean;
  channels: NotificationChannel[];
  createdAt: Date;
  readAt?: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 2. Implement the Service

```typescript
// services/notification-service.ts
import { NotificationService, SendNotificationInput, SendBulkNotificationInput, GetNotificationsOptions, Notification, PaginatedResult } from "./interfaces/notification-service";
import { NotificationRepository } from "../repositories/notification-repository";
import { EmailService } from "./email-service";
import { PushService } from "./push-service";
import { CacheService } from "./cache-service";
import { logger } from "../logger";

export class NotificationServiceImpl implements NotificationService {
  constructor(
    private notificationRepository: NotificationRepository,
    private emailService: EmailService,
    private pushService: PushService,
    private cacheService: CacheService
  ) {}

  async sendNotification(input: SendNotificationInput): Promise<Notification> {
    const {
      userId,
      type,
      title,
      message,
      data,
      priority = "medium",
      channels = ["in_app"],
    } = input;

    // Create notification record
    const notification = await this.notificationRepository.create({
      userId,
      type,
      title,
      message,
      data,
      priority,
      channels,
      isRead: false,
    });

    // Send through specified channels
    await this.sendThroughChannels(notification, channels);

    // Invalidate cache
    await this.cacheService.invalidate(`notifications:${userId}:*`);

    logger.info("Notification sent", {
      notificationId: notification.id,
      userId,
      type,
      channels,
    });

    return notification;
  }

  async sendBulkNotifications(input: SendBulkNotificationInput): Promise<Notification[]> {
    const { userIds, type, title, message, data, priority = "medium" } = input;

    // Create all notifications
    const notifications = await this.notificationRepository.createBulk(
      userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        data,
        priority,
        channels: ["in_app"],
        isRead: false,
      }))
    );

    // Send emails for all users
    const emailPromises = notifications.map((notification) =>
      this.emailService.sendNotificationEmail(notification).catch((error) => {
        logger.error("Failed to send bulk email", {
          notificationId: notification.id,
          error,
        });
      })
    );

    await Promise.allSettled(emailPromises);

    // Invalidate caches for all users
    const cacheInvalidations = userIds.map((userId) =>
      this.cacheService.invalidate(`notifications:${userId}:*`)
    );

    await Promise.all(cacheInvalidations);

    logger.info("Bulk notifications sent", {
      count: notifications.length,
      type,
    });

    return notifications;
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    return this.notificationRepository.findById(id);
  }

  async getUserNotifications(
    userId: string,
    options: GetNotificationsOptions = {}
  ): Promise<PaginatedResult<Notification>> {
    const page = options.page || 1;
    const limit = options.limit || 20;

    // Try cache first
    const cacheKey = `notifications:${userId}:${JSON.stringify(options)}`;
    const cached = await this.cacheService.get<PaginatedResult<Notification>>(cacheKey);

    if (cached) {
      return cached;
    }

    // Query database
    const result = await this.notificationRepository.findByUserId(userId, options);

    // Cache for 30 seconds
    await this.cacheService.set(cacheKey, result, 30);

    return result;
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findById(id);

    if (!notification) {
      throw new NotificationNotFoundError(id);
    }

    const updated = await this.notificationRepository.update(id, {
      isRead: true,
      readAt: new Date(),
    });

    // Invalidate cache
    await this.cacheService.invalidate(`notifications:${notification.userId}:*`);

    logger.info("Notification marked as read", {
      notificationId: id,
      userId: notification.userId,
    });

    return updated;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const count = await this.notificationRepository.markAllAsRead(userId);

    // Invalidate cache
    await this.cacheService.invalidate(`notifications:${userId}:*`);

    logger.info("All notifications marked as read", {
      userId,
      count,
    });

    return count;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const notification = await this.notificationRepository.findById(id);

    if (!notification) {
      throw new NotificationNotFoundError(id);
    }

    const deleted = await this.notificationRepository.delete(id);

    // Invalidate cache
    await this.cacheService.invalidate(`notifications:${notification.userId}:*`);

    return deleted;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `notifications:${userId}:unreadCount`;
    const cached = await this.cacheService.get<number>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const count = await this.notificationRepository.countUnread(userId);

    // Cache for 10 seconds
    await this.cacheService.set(cacheKey, count, 10);

    return count;
  }

  private async sendThroughChannels(
    notification: Notification,
    channels: string[]
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    if (channels.includes("email")) {
      promises.push(
        this.emailService.sendNotificationEmail(notification).catch((error) => {
          logger.error("Failed to send email notification", {
            notificationId: notification.id,
            error,
          });
        })
      );
    }

    if (channels.includes("push")) {
      promises.push(
        this.pushService.sendPushNotification(notification).catch((error) => {
          logger.error("Failed to send push notification", {
            notificationId: notification.id,
            error,
          });
        })
      );
    }

    await Promise.allSettled(promises);
  }
}

class NotificationNotFoundError extends Error {
  constructor(id: string) {
    super(`Notification ${id} not found`);
    this.name = "NotificationNotFoundError";
  }
}
```

### 3. External Service Integration

```typescript
// services/email-service.ts
import { Notification } from "./interfaces/notification-service";
import { mailer } from "../mailer";
import { logger } from "../logger";

export class EmailService {
  async sendNotificationEmail(notification: Notification): Promise<void> {
    const { userId, title, message, type } = notification;

    // Get user email
    const user = await this.getUserEmail(userId);
    if (!user) {
      logger.warn("User not found for email notification", { userId });
      return;
    }

    // Build email
    const email = {
      to: user.email,
      subject: title,
      template: "notification",
      data: {
        name: user.name,
        title,
        message,
        type,
        actionUrl: this.getActionUrl(notification),
      },
    };

    // Send email
    await mailer.send(email);

    logger.info("Notification email sent", {
      notificationId: notification.id,
      to: user.email,
    });
  }

  private async getUserEmail(userId: string): Promise<{ email: string; name: string } | null> {
    // Implementation to get user email from database
    return null;
  }

  private getActionUrl(notification: Notification): string {
    const baseUrl = process.env.APP_URL || "https://app.example.com";

    if (notification.data?.taskId) {
      return `${baseUrl}/tasks/${notification.data.taskId}`;
    }

    if (notification.data?.projectId) {
      return `${baseUrl}/projects/${notification.data.projectId}`;
    }

    return `${baseUrl}/notifications`;
  }
}
```

### 4. Caching Service

```typescript
// services/cache-service.ts
import NodeCache from "node-cache";

export class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 60,
      checkperiod: 120,
      useClones: false,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.cache.get<T>(key);
    return value ?? null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, value, ttl || 60);
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = this.cache.keys();
    const matchingKeys = keys.filter((key) => {
      // Convert pattern to regex
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
      );
      return regex.test(key);
    });

    if (matchingKeys.length > 0) {
      this.cache.del(matchingKeys);
    }
  }

  async flush(): Promise<void> {
    this.cache.flushAll();
  }

  getStats() {
    return this.cache.getStats();
  }
}
```

### 5. Service Tests

```typescript
// services/notification-service.test.ts
import { NotificationServiceImpl } from "./notification-service";
import { NotificationRepository } from "../repositories/notification-repository";
import { EmailService } from "./email-service";
import { PushService } from "./push-service";
import { CacheService } from "./cache-service";

jest.mock("../repositories/notification-repository");
jest.mock("./email-service");
jest.mock("./push-service");
jest.mock("./cache-service");

describe("NotificationService", () => {
  let service: NotificationServiceImpl;
  let mockRepository: jest.Mocked<NotificationRepository>;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockPushService: jest.Mocked<PushService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      createBulk: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      markAllAsRead: jest.fn(),
      countUnread: jest.fn(),
    } as any;

    mockEmailService = {
      sendNotificationEmail: jest.fn(),
    } as any;

    mockPushService = {
      sendPushNotification: jest.fn(),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
    } as any;

    service = new NotificationServiceImpl(
      mockRepository,
      mockEmailService,
      mockPushService,
      mockCacheService
    );
  });

  describe("sendNotification", () => {
    it("creates and sends notification", async () => {
      const input = {
        userId: "user-1",
        type: "info" as const,
        title: "Test",
        message: "Test message",
      };

      const mockNotification = {
        id: "notif-1",
        ...input,
        priority: "medium",
        channels: ["in_app"],
        isRead: false,
        createdAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(mockNotification as any);

      const result = await service.sendNotification(input);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "info",
          title: "Test",
        })
      );
      expect(mockCacheService.invalidate).toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it("sends email when channel specified", async () => {
      const input = {
        userId: "user-1",
        type: "info" as const,
        title: "Test",
        message: "Test message",
        channels: ["in_app", "email"],
      };

      const mockNotification = {
        id: "notif-1",
        ...input,
        priority: "medium",
        isRead: false,
        createdAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(mockNotification as any);
      mockEmailService.sendNotificationEmail.mockResolvedValue();

      await service.sendNotification(input);

      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        mockNotification
      );
    });
  });

  describe("markAsRead", () => {
    it("marks notification as read", async () => {
      const mockNotification = {
        id: "notif-1",
        userId: "user-1",
        isRead: false,
      };

      mockRepository.findById.mockResolvedValue(mockNotification as any);
      mockRepository.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      } as any);

      const result = await service.markAsRead("notif-1");

      expect(result.isRead).toBe(true);
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });

    it("throws if notification not found", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.markAsRead("nonexistent")).rejects.toThrow(
        "Notification nonexistent not found"
      );
    });
  });

  describe("getUnreadCount", () => {
    it("returns cached count if available", async () => {
      mockCacheService.get.mockResolvedValue(5);

      const result = await service.getUnreadCount("user-1");

      expect(result).toBe(5);
      expect(mockRepository.countUnread).not.toHaveBeenCalled();
    });

    it("queries database if cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.countUnread.mockResolvedValue(3);

      const result = await service.getUnreadCount("user-1");

      expect(result).toBe(3);
      expect(mockRepository.countUnread).toHaveBeenCalledWith("user-1");
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining("unreadCount"),
        3,
        10
      );
    });
  });
});
```

---

## Dependency Injection Registration

```typescript
// container.ts
import { DataSource } from "typeorm";
import { NotificationServiceImpl } from "./services/notification-service";
import { NotificationRepository } from "./repositories/notification-repository";
import { EmailService } from "./services/email-service";
import { PushService } from "./services/push-service";
import { CacheService } from "./services/cache-service";

export function createNotificationService(dataSource: DataSource) {
  const notificationRepository = new NotificationRepository(dataSource);
  const emailService = new EmailService();
  const pushService = new PushService();
  const cacheService = new CacheService();

  return new NotificationServiceImpl(
    notificationRepository,
    emailService,
    pushService,
    cacheService
  );
}
```

---

## Service Checklist

### Structure
- [ ] Interface defined
- [ ] Implementation follows interface
- [ ] Dependencies injected via constructor
- [ ] Proper error handling
- [ ] Logging at key points

### Business Logic
- [ ] Single responsibility
- [ ] No direct database access (use repository)
- [ ] No HTTP concerns (use controller)
- [ ] Validation at service level
- [ ] Transaction handling where needed

### Error Handling
- [ ] Custom error classes
- [ ] Proper error propagation
- [ ] Error logging
- [ ] Graceful degradation

### Caching
- [ ] Cache strategy defined
- [ ] Cache invalidation on mutations
- [ ] TTL configured appropriately
- [ ] Cache key naming convention

### Testing
- [ ] Unit tests for all public methods
- [ ] Mock dependencies
- [ ] Test error scenarios
- [ ] Test edge cases

### Documentation
- [ ] Interface documented
- [ ] Complex logic commented
- [ ] API usage examples

---

## Common Mistakes to Avoid

1. **Direct database access** - Always use repository pattern
2. **HTTP concerns in service** - Keep services framework-agnostic
3. **No error handling** - Always handle and log errors
4. **God services** - Keep services focused
5. **Tight coupling** - Use dependency injection
6. **No caching** - Cache frequently accessed data
7. **Missing validation** - Validate inputs at service level
8. **Synchronous operations** - Use async/await properly
9. **No logging** - Log important operations
10. **Skipping tests** - Write comprehensive tests

---

## Cross-References

- See `repository.md` for repository creation
- See `controller.md` for controller that uses services
- See `api.md` for API endpoints that use services
- See `new-feature.md` for the full feature creation process
