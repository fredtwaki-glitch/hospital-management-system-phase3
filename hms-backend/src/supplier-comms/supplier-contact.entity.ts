import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Not yet linked to an actual email/SMS send - see SupplierCommsService.
 * Exists so the "approve & send" step has somewhere to look up contact
 * details once real delivery is wired up.
 */
@Entity('supplier_contacts')
export class SupplierContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  notes: string;
}
