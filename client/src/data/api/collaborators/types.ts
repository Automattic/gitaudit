export interface Collaborator {
  userId: number;
  username: string;
  githubId: number;
  role: 'admin' | 'member';
  dateAdded: string;
}

export interface CollaboratorsResponse {
  collaborators: Collaborator[];
}

export interface AddCollaboratorRequest {
  username: string;
  role: 'admin' | 'member';
}

export interface UpdateCollaboratorRequest {
  role: 'admin' | 'member';
}
