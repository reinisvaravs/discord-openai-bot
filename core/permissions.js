export function hasAllowedRole(member) {
  if (!member) return false;
  return member.roles.cache.some((role) => {
    const name = role.name.toLowerCase();
    return name === "owner" || name === "admin";
  });
}

export function hasAllowedRoleFromMessage(message) {
  return hasAllowedRole(message.member);
}
