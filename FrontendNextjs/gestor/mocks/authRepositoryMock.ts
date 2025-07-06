import { User } from "@/types/user";

export class AuthRepositoryMock {
  private mockUsers: User[] = [
    {
      id: "user-123",
      name: "Juan",
      last_name: "Pérez",
      email: "juan.perez@example.com",
      password: "hashed_password_123",
      token: "mock-token-123",
      confirmend: "confirmed",
      created_at: new Date("2024-01-10T08:00:00Z"),
    },
    {
      id: "user-456",
      name: "María",
      last_name: "González",
      email: "maria.gonzalez@example.com",
      password: "hashed_password_456",
      token: "mock-token-456",
      confirmend: "confirmed",
      created_at: new Date("2024-01-12T10:15:00Z"),
    },
  ];

  login = async (email: string, password: string): Promise<User | null> => {
    console.log("🔍 AuthRepositoryMock.login called with:", { email, password });
    
    // Simular delay del servidor (reducido)
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const user = this.mockUsers.find(u => u.email === email);
    console.log("👤 Usuario encontrado:", user);
    
    if (!user) {
      console.log("❌ Usuario no encontrado");
      throw new Error("Usuario no encontrado");
    }
    
    // En un escenario real, aquí verificarías el password hash
    // Para el mock, simplemente simulamos que es correcto
    const mockToken = `mock-token-${Date.now()}`;
    console.log("🔑 Token generado:", mockToken);
    
    // IMPORTANTE: Actualizar el token del usuario en la lista
    user.token = mockToken;
    
    // Simular el guardado de token (sin cookies por ahora)
    // Si estás en el navegador, intentar usar cookies
    if (typeof window !== 'undefined') {
      try {
        const Cookies = require('js-cookie');
        Cookies.set("x-token", mockToken);
        console.log("🍪 Token guardado en cookies");
      } catch (error) {
        console.log("⚠️ No se pudo guardar en cookies:", error);
      }
    }
    
    const userWithToken: User = {
      ...user,
      token: mockToken,
    };
    
    console.log("✅ Login exitoso, retornando usuario:", userWithToken);
    return userWithToken;
  };

  signUp = async (
    name: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<void> => {
    console.log("📝 AuthRepositoryMock.signUp called with:", { name, lastName, email });
    
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar si el usuario ya existe
    const existingUser = this.mockUsers.find(u => u.email === email);
    if (existingUser) {
      console.log("❌ Usuario ya existe");
      throw new Error("El usuario ya existe");
    }
    
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      last_name: lastName,
      email,
      password: `hashed_${password}`, // En producción sería un hash real
      token: `mock-token-${Date.now()}`,
      confirmend: "pending",
      created_at: new Date(),
    };
    
    this.mockUsers.push(newUser);
    console.log("✅ Usuario registrado:", newUser);
  };

  getProfile = async (token: string): Promise<User | null> => {
    console.log("👤 AuthRepositoryMock.getProfile called with token:", token);
    
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const user = this.mockUsers.find(u => u.token === token);
    if (!user) {
      console.log("❌ Token inválido");
      throw new Error("Token inválido");
    }
    
    console.log("✅ Perfil encontrado:", user);
    return user;
  };
} 