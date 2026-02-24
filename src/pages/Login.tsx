import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) navigate('/feed');
      })
      .catch(() => {});
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      if (res.ok) {
        navigate('/feed');
      } else {
        const data = await res.json();
        console.error('Login failed:', data);
        setError(data.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-[350px] glass border-white/10">
        <CardHeader>
          <CardTitle className="text-3xl font-display font-bold text-white tracking-tight">friendly</CardTitle>
          <CardDescription className="text-gray-400">Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Input 
                  placeholder="Email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-accent"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Input 
                  placeholder="Password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-accent"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <Button className="w-full mt-6 bg-accent hover:bg-accent/90 text-white font-semibold" type="submit">Login</Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-400">
            Don't have an account? <Link to="/register" className="text-accent hover:underline">Sign up</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
