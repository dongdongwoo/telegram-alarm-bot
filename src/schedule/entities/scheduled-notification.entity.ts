import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('scheduled_notifications')
export class ScheduledNotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  type: 'fixed' | 'manual';

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 50 })
  chatId: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cron: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;
}
