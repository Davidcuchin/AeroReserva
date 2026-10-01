export type Person = {
  id: string;
  name: string;
  email: string;
  role: "ALUMNO" | "INSTRUCTOR" | "ADMINISTRADOR";
  active: boolean;
  qualifications: { id: string; model: string; validUntil: string }[];
};
export type Plane = {
  id: string;
  registration: string;
  model: string;
  seats: number;
  active: boolean;
};
export type Flight = {
  id: string;
  studentId: string;
  instructorId: string;
  aircraftId: string;
  start: string;
  end: string;
  status: string;
  note: string;
  reminder: boolean;
  reminderRead: boolean;
  student: string;
  instructor: string;
  registration: string;
  model: string;
  private: boolean;
  cancelReason: string | null;
};
export type AppData = {
  user: Person;
  users: Person[];
  planes: Plane[];
  flights: Flight[];
  resources: { id: string; label: string }[];
  blocks: {
    id: string;
    resourceId: string;
    start: string;
    end: string;
    reason: string;
    active: boolean;
  }[];
  availability: { id: string; userId: string; start: string; end: string }[];
  audits: {
    id: string;
    actor: string;
    entity: string;
    entityId: string;
    action: string;
    reason: string;
    createdAt: string;
    before: unknown;
    after: unknown;
  }[];
};
