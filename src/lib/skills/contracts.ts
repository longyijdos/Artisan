export type SkillStatusContract = "core" | "installed" | "available";

export interface SkillContract {
  name: string;
  status: SkillStatusContract;
  description: string;
}

export interface SkillListResponseContract {
  skills?: SkillContract[];
  detail?: string;
}

export interface SkillMutationRequestBody {
  skill_name: string;
  thread_id: string;
}

export interface SkillMutationResponseContract {
  success?: boolean;
  message?: string;
  skill_name?: string;
  detail?: string;
}

export interface SkillUploadResponseContract {
  success?: boolean;
  message?: string;
  skill_name?: string;
  detail?: string;
}
