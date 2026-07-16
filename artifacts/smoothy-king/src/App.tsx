import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import Layout from '@/components/layout';

import Home from '@/pages/home';
import Recipes from '@/pages/recipes';
import RecipeDetail from '@/pages/recipe-detail';
import Ingredients from '@/pages/ingredients';
import Favorites from '@/pages/favorites';
import Builder from '@/pages/builder';
import Community from '@/pages/community';
import Membership from '@/pages/membership';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/recipes" component={Recipes} />
        <Route path="/recipes/:id" component={RecipeDetail} />
        <Route path="/ingredients" component={Ingredients} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/builder" component={Builder} />
        <Route path="/community" component={Community} />
        <Route path="/membership" component={Membership} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
