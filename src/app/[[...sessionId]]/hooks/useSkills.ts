"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  SkillContract,
  SkillListResponseContract,
} from "@/lib/skills/contracts";
import type { Skill } from "@/components/SkillsLibrary";

function sortSkills(skills: Skill[]): Skill[] {
  const statusPriority: Record<string, number> = { core: 0, installed: 1, available: 2 };
  return [...skills].sort((a, b) => {
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status];
    }
    return a.name.localeCompare(b.name);
  });
}

export interface UseSkillsReturn {
  skills: Skill[];
  isSkillsLoading: boolean;
  skillsError: string | null;
  fetchSkills: () => Promise<void>;
  handleUpdateSkill: (skillName: string, newStatus: "installed" | "available" | "core") => void;
}

export function useSkills(
  currentSessionId: string | null,
  isSessionLoading: boolean,
): UseSkillsReturn {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isSkillsLoading, setIsSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      setIsSkillsLoading(true);
      setSkillsError(null);
      const response = await fetch(
        `/api/skills/list?threadId=${encodeURIComponent(currentSessionId)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch skills: ${response.statusText}`);
      }
      const data = (await response.json()) as SkillListResponseContract;
      const fetchedSkills = (data.skills || []) as SkillContract[];
      setSkills(sortSkills(fetchedSkills));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load skills";
      setSkillsError(message);
    } finally {
      setIsSkillsLoading(false);
    }
  }, [currentSessionId]);

  // Fetch skills when session changes, but wait for session to load first
  useEffect(() => {
    if (currentSessionId && !isSessionLoading) {
      setSkills([]);
      fetchSkills();
    }
  }, [currentSessionId, isSessionLoading, fetchSkills]);

  const handleUpdateSkill = useCallback(
    (skillName: string, newStatus: "installed" | "available" | "core") => {
      setSkills((prevSkills) => {
        const newSkills = prevSkills.map((s) =>
          s.name === skillName ? { ...s, status: newStatus } : s,
        );
        return sortSkills(newSkills);
      });
    },
    [],
  );

  return {
    skills,
    isSkillsLoading,
    skillsError,
    fetchSkills,
    handleUpdateSkill,
  };
}
