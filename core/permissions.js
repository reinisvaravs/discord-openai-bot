export function hasAllowedRole(message) {
  const member = message.member;
  if (!member) return false;
  return member.roles.cache.some((role) => {
    const name = role.name.toLowerCase();
    return name === "owner" || name === "admin";
  });
}
